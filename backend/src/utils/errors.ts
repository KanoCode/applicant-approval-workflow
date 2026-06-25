/**
 * Structured, typed errors that the error-handling middleware (see
 * middleware/errorHandler.ts) converts into consistent JSON responses:
 *   { "error": { "code": string, "message": string, "details"?: unknown } }
 *
 * Every route handler should throw one of these (or let Zod's
 * ZodError / Prisma's known errors propagate) rather than crafting
 * res.status(...).json(...) inline, so that error shape stays uniform
 * across the whole API.
 */

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found.`);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You are not allowed to perform this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}
