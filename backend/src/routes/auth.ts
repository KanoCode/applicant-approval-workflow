import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { loginSchema } from '../utils/validation';
import { signToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { authenticate } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, email, name, role } }
 *
 * Deliberately returns the same 401 message whether the email doesn't
 * exist or the password is wrong, so the endpoint doesn't leak which
 * emails are registered.
 */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }),
);

/**
 * GET /api/auth/me
 * Returns the current user, derived only from the verified JWT — useful for
 * the frontend to restore session state on reload without re-sending
 * credentials.
 */
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      throw new UnauthorizedError('User no longer exists.');
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }),
);
