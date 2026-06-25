import { Router } from 'express';
import { Prisma } from '../../prisma/generated/client';
import { prisma } from '../config/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { upload } from '../middleware/upload';
import {
  createApplicationSchema,
  updateApplicationSchema,
  transitionSchema,
} from '../utils/validation';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { applyTransition, canEdit, canDelete, Action } from '../services/stateMachine';

export const applicationsRouter = Router();

applicationsRouter.use(authenticate);

const APPLICATION_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ApplicationInclude;

/**
 * GET /api/applications
 * - Applicant: returns only their own applications (any status).
 * - Reviewer: returns the review queue — SUBMITTED/UNDER_REVIEW by default,
 *   or a specific status via ?status=, or everything via ?status=ALL.
 *   DRAFT applications are never returned to reviewers: they are not yet
 *   submitted and the spec says drafts are owner-only.
 */
applicationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;

    if (user.role === 'APPLICANT') {
      const applications = await prisma.application.findMany({
        where: { ownerId: user.id },
        include: APPLICATION_INCLUDE,
        orderBy: { updatedAt: 'desc' },
      });
      res.json({ applications });
      return;
    }

    // REVIEWER
    let where: Prisma.ApplicationWhereInput;
    if (!statusParam) {
      where = { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } };
    } else if (statusParam === 'ALL') {
      where = { status: { not: 'DRAFT' } };
    } else {
      const allowed = ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED'];
      if (!allowed.includes(statusParam)) {
        throw new ValidationError(`status must be one of: ${allowed.join(', ')}, ALL`);
      }
      where = { status: statusParam as Prisma.ApplicationWhereInput['status'] };
    }

    const applications = await prisma.application.findMany({
      where,
      include: APPLICATION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  }),
);

/**
 * GET /api/applications/:id
 * Applicant may view only their own; Reviewer may view any non-draft.
 * Includes the full audit trail for the detail page.
 */
applicationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        ...APPLICATION_INCLUDE,
        auditLog: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundError('Application');
    }

    const isOwner = application.ownerId === user.id;
    if (user.role === 'APPLICANT' && !isOwner) {
      throw new ForbiddenError('You may only view your own applications.');
    }
    if (user.role === 'REVIEWER' && application.status === 'DRAFT') {
      throw new ForbiddenError('Draft applications are not visible to reviewers.');
    }

    res.json({
      application,
      permissions: {
        canEdit: canEdit(application.status, user.role, isOwner),
        canDelete: canDelete(application.status, user.role, isOwner),
        canSubmit: user.role === 'APPLICANT' && isOwner && canEdit(application.status, user.role, isOwner),
      },
    });
  }),
);

/**
 * POST /api/applications
 * Applicant only. Creates a new DRAFT. (requireRole enforces this before
 * the handler runs — a Reviewer's token is rejected with 403 here, not
 * silently allowed and filtered later.)
 */
applicationsRouter.post(
  '/',
  requireRole('APPLICANT'),
  asyncHandler(async (req, res) => {
    const data = createApplicationSchema.parse(req.body);
    const application = await prisma.application.create({
      data: {
        title: data.title,
        category: data.category,
        description: data.description,
        amount: data.amount,
        ownerId: req.user!.id,
        status: 'DRAFT',
      },
      include: APPLICATION_INCLUDE,
    });
    res.status(201).json({ application });
  }),
);

/**
 * PUT /api/applications/:id
 * Applicant (owner) only, and only while the application is in an editable
 * status (DRAFT or RETURNED). This is enforced here, not just hidden in the
 * UI: an owner trying to PUT a SUBMITTED application gets 403, not a silent
 * no-op or a 200 that doesn't actually change anything.
 */
applicationsRouter.put(
  '/:id',
  requireRole('APPLICANT'),
  asyncHandler(async (req, res) => {
    const data = updateApplicationSchema.parse(req.body);
    const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new NotFoundError('Application');
    }
    const isOwner = existing.ownerId === req.user!.id;
    if (!isOwner) {
      throw new ForbiddenError('You may only edit your own applications.');
    }
    if (!canEdit(existing.status, 'APPLICANT', isOwner)) {
      throw new ForbiddenError(
        `Application cannot be edited while in status ${existing.status}.`,
      );
    }

    const application = await prisma.application.update({
      where: { id: req.params.id },
      data: {
        title: data.title,
        category: data.category,
        description: data.description,
        amount: data.amount,
      },
      include: APPLICATION_INCLUDE,
    });
    res.json({ application });
  }),
);

/**
 * DELETE /api/applications/:id
 * Applicant (owner) only, only while in an editable (DRAFT/RETURNED) status.
 */
applicationsRouter.delete(
  '/:id',
  requireRole('APPLICANT'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new NotFoundError('Application');
    }
    const isOwner = existing.ownerId === req.user!.id;
    if (!isOwner) {
      throw new ForbiddenError('You may only delete your own applications.');
    }
    if (!canDelete(existing.status, 'APPLICANT', isOwner)) {
      throw new ForbiddenError(
        `Application cannot be deleted while in status ${existing.status}.`,
      );
    }
    // Audit rows reference the application via a required FK, so we delete
    // them first; a draft that never left DRAFT will have none anyway.
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { applicationId: existing.id } }),
      prisma.application.delete({ where: { id: existing.id } }),
    ]);
    res.status(204).send();
  }),
);

/**
 * POST /api/applications/:id/attachment
 * Applicant (owner) only, only while editable. Demonstrates file handling
 * for the optional attachment field. Stores the original filename
 * separately from the on-disk (randomized) filename to avoid path
 * traversal / collision issues while still showing the user a sensible name.
 */
applicationsRouter.post(
  '/:id/attachment',
  requireRole('APPLICANT'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new NotFoundError('Application');
    }
    const isOwner = existing.ownerId === req.user!.id;
    if (!isOwner) {
      throw new ForbiddenError('You may only attach files to your own applications.');
    }
    if (!canEdit(existing.status, 'APPLICANT', isOwner)) {
      throw new ForbiddenError(
        `Attachments cannot be changed while in status ${existing.status}.`,
      );
    }
    if (!req.file) {
      throw new ValidationError('No file was uploaded, or the file type is unsupported.');
    }

    const application = await prisma.application.update({
      where: { id: existing.id },
      data: {
        attachmentPath: req.file.filename,
        attachmentName: req.file.originalname,
      },
      include: APPLICATION_INCLUDE,
    });
    res.json({ application });
  }),
);

/**
 * Shared handler for every status-transition endpoint. The action name maps
 * 1:1 onto stateMachine.Action, and the route's requireRole already filters
 * by the *expected* actor role for clarity/early-exit, but applyTransition
 * is the actual source of truth — it independently re-checks role and
 * ownership, so even if a route were mis-wired the transition itself can't
 * silently succeed for the wrong actor.
 */
function makeTransitionHandler(action: Action) {
  return asyncHandler(async (req, res) => {
    const user = req.user!;
    const { comment } = transitionSchema.parse(req.body ?? {});

    const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw new NotFoundError('Application');
    }

    const isOwner = existing.ownerId === user.id;
    const { nextStatus } = applyTransition({
      currentStatus: existing.status,
      action,
      actorRole: user.role,
      isOwner,
      comment,
    });

    const [application] = await prisma.$transaction([
      prisma.application.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          // A reviewer claiming/deciding becomes the recorded reviewer;
          // submitting/resubmitting doesn't touch reviewerId.
          ...(user.role === 'REVIEWER' ? { reviewerId: user.id } : {}),
        },
        include: APPLICATION_INCLUDE,
      }),
      prisma.auditLog.create({
        data: {
          applicationId: existing.id,
          actorId: user.id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          comment: comment ?? null,
        },
      }),
    ]);

    res.json({ application });
  });
}

applicationsRouter.post('/:id/submit', requireRole('APPLICANT'), makeTransitionHandler('SUBMIT'));
applicationsRouter.post('/:id/claim', requireRole('REVIEWER'), makeTransitionHandler('CLAIM'));
applicationsRouter.post('/:id/approve', requireRole('REVIEWER'), makeTransitionHandler('APPROVE'));
applicationsRouter.post('/:id/reject', requireRole('REVIEWER'), makeTransitionHandler('REJECT'));
applicationsRouter.post('/:id/return', requireRole('REVIEWER'), makeTransitionHandler('RETURN'));
