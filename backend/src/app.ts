import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env';
import { authRouter } from './routes/auth';
import { applicationsRouter } from './routes/applications';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Builds the Express app without starting a listener. Kept separate from
 * server.ts so API tests (supertest) can import `createApp()` directly
 * instead of spinning up a real HTTP server on a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/applications', applicationsRouter);

  // Uploaded attachments are served statically for download/preview.
  // Real auth on individual files is out of scope for this exercise (the
  // README notes this as a known trade-off); filenames are randomized
  // UUIDs so they aren't guessable in practice.
  app.use('/uploads', express.static(path.resolve(config.uploadDir)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
