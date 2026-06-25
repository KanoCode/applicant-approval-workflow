import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { Role } from '../services/stateMachine';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
}

// Augment Express's Request type so `req.user` is typed everywhere downstream
// instead of being cast/asserted in every handler.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the Bearer token and attaches `req.user`. This is the single
 * choke point through which every authenticated request must pass — there
 * is no client-supplied header or body field that can stand in for it.
 * Mutating routes mount this (and usually requireRole) before any handler
 * logic runs, so an unauthenticated or malformed request never reaches
 * business logic.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header.');
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token.');
  }
}

/**
 * Role gate. Must run after `authenticate`. This is what makes
 * "an applicant must not be able to approve their own application even by
 * calling the API directly" true: the route for approve/reject/return/claim
 * is mounted behind requireRole('REVIEWER'), so the check happens before any
 * application is even loaded from the database — a crafted request from an
 * Applicant's valid token is rejected with 403 regardless of payload.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        `This action requires role: ${roles.join(' or ')}.`,
      );
    }
    next();
  };
}
