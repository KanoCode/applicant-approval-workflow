// Ensures required env vars exist before any module (e.g. src/utils/jwt.ts)
// reads process.env at import time.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.NODE_ENV = 'test';
