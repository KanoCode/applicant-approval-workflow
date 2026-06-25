/**
 * Pure state machine for the Application workflow.
 *
 * This module has zero dependencies on Express, Prisma, or the database.
 * It takes a status, an actor's role, and an action, and either returns the
 * next status or throws a StateTransitionError. Keeping it pure means the
 * transition table itself is fully unit-testable without spinning up a DB
 * or an HTTP server (see src/__tests__/stateMachine.test.ts).
 *
 * Statuses:
 *   DRAFT        - editable by the owner only. Not visible to reviewers.
 *   SUBMITTED    - owner can no longer edit. Waiting in the reviewer queue.
 *   UNDER_REVIEW - a reviewer has claimed it. Still owner-uneditable.
 *   RETURNED     - reviewer sent it back with required feedback. Owner can
 *                  edit again (like DRAFT) and re-submit.
 *   APPROVED     - terminal.
 *   REJECTED     - terminal.
 */

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED';

export type Role = 'APPLICANT' | 'REVIEWER';

export type Action =
  | 'SUBMIT' // DRAFT|RETURNED -> SUBMITTED (owner)
  | 'CLAIM' // SUBMITTED -> UNDER_REVIEW (reviewer)
  | 'APPROVE' // SUBMITTED|UNDER_REVIEW -> APPROVED (reviewer)
  | 'REJECT' // SUBMITTED|UNDER_REVIEW -> REJECTED (reviewer, comment required)
  | 'RETURN'; // SUBMITTED|UNDER_REVIEW -> RETURNED (reviewer, comment required)

export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'APPROVED',
  'REJECTED',
]);

/** Statuses the owner may edit the application's fields in. */
export const EDITABLE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'DRAFT',
  'RETURNED',
]);

export class StateTransitionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'ILLEGAL_TRANSITION'
      | 'FORBIDDEN_ROLE'
      | 'COMMENT_REQUIRED' = 'ILLEGAL_TRANSITION',
  ) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

interface TransitionRule {
  from: ApplicationStatus[];
  to: ApplicationStatus;
  allowedRole: Role;
  requiresComment: boolean;
}

const RULES: Record<Action, TransitionRule> = {
  SUBMIT: {
    from: ['DRAFT', 'RETURNED'],
    to: 'SUBMITTED',
    allowedRole: 'APPLICANT',
    requiresComment: false,
  },
  CLAIM: {
    from: ['SUBMITTED'],
    to: 'UNDER_REVIEW',
    allowedRole: 'REVIEWER',
    requiresComment: false,
  },
  APPROVE: {
    from: ['SUBMITTED', 'UNDER_REVIEW'],
    to: 'APPROVED',
    allowedRole: 'REVIEWER',
    requiresComment: false,
  },
  REJECT: {
    from: ['SUBMITTED', 'UNDER_REVIEW'],
    to: 'REJECTED',
    allowedRole: 'REVIEWER',
    requiresComment: true,
  },
  RETURN: {
    from: ['SUBMITTED', 'UNDER_REVIEW'],
    to: 'RETURNED',
    allowedRole: 'REVIEWER',
    requiresComment: true,
  },
};

export interface TransitionInput {
  currentStatus: ApplicationStatus;
  action: Action;
  actorRole: Role;
  /** True if the actor owns (created) the application. Ignored for reviewer-only actions. */
  isOwner: boolean;
  comment?: string | null;
}

export interface TransitionResult {
  nextStatus: ApplicationStatus;
}

/**
 * Validate and compute a transition. Throws StateTransitionError if the
 * transition is illegal, the actor's role/ownership doesn't permit it, or a
 * required comment is missing/blank. Never mutates anything — purely
 * functional, so the caller (the route handler) is responsible for
 * persisting the result and writing the audit log row.
 */
export function applyTransition(input: TransitionInput): TransitionResult {
  const { currentStatus, action, actorRole, isOwner, comment } = input;
  const rule = RULES[action];

  if (TERMINAL_STATUSES.has(currentStatus)) {
    throw new StateTransitionError(
      `Application is in terminal status ${currentStatus}; no further transitions are allowed.`,
      'ILLEGAL_TRANSITION',
    );
  }

  if (!rule.from.includes(currentStatus)) {
    throw new StateTransitionError(
      `Cannot perform ${action} from status ${currentStatus}. Allowed source statuses: ${rule.from.join(', ')}.`,
      'ILLEGAL_TRANSITION',
    );
  }

  if (actorRole !== rule.allowedRole) {
    throw new StateTransitionError(
      `Action ${action} may only be performed by a ${rule.allowedRole}.`,
      'FORBIDDEN_ROLE',
    );
  }

  // Owner-only actions (currently just SUBMIT) must additionally check
  // that the actor is the owner — an Applicant role alone isn't enough,
  // since one applicant must not be able to submit another's draft.
  if (rule.allowedRole === 'APPLICANT' && !isOwner) {
    throw new StateTransitionError(
      'Only the owner of this application may perform this action.',
      'FORBIDDEN_ROLE',
    );
  }

  if (rule.requiresComment && (!comment || comment.trim().length === 0)) {
    throw new StateTransitionError(
      `Action ${action} requires a non-empty comment.`,
      'COMMENT_REQUIRED',
    );
  }

  return { nextStatus: rule.to };
}

/** Whether `role` may edit an application's fields given its current status and ownership. */
export function canEdit(
  status: ApplicationStatus,
  role: Role,
  isOwner: boolean,
): boolean {
  return role === 'APPLICANT' && isOwner && EDITABLE_STATUSES.has(status);
}

/** Whether `role` may delete a draft application. Mirrors canEdit: only the owner, only pre-submission states. */
export function canDelete(
  status: ApplicationStatus,
  role: Role,
  isOwner: boolean,
): boolean {
  return canEdit(status, role, isOwner);
}
