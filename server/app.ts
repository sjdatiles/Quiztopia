import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { attachSession } from './auth.ts';
import { firebaseInitError, useRemoteFirestore } from './firebase.ts';
import { authRouter } from './routes/authRoutes.ts';
import { teacherRouter } from './routes/teacherRoutes.ts';
import { teamRouter } from './routes/teamRoutes.ts';
import { ensureSeeded } from './seed.ts';

export function createExpressApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    if (req.body !== undefined) {
      if (typeof req.body === 'string') {
        try {
          req.body = req.body.trim() ? JSON.parse(req.body) : {};
        } catch {
          res.status(400).json({ error: 'Invalid JSON request body.' });
          return;
        }
      }
      if (req.body !== null && typeof req.body === 'object') {
        next();
        return;
      }
    }
    express.json({ limit: '1mb' })(req, res, next);
  });
  app.use(cookieParser());
  app.use(attachSession);

  // Health probe
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureSeeded();
      res.json({
        ok: true,
        service: 'quiztopia',
        db: useRemoteFirestore ? 'firestore' : 'local',
        ...(firebaseInitError ? { warning: firebaseInitError } : {}),
      });
    } catch (err: any) {
      console.error('Health check failed:', err);
      res.status(500).json({
        ok: false,
        error: err?.message || 'Database initialization failed.',
      });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/team', teamRouter);

  // Always return JSON for unmatched /api/* routes so clients never get opaque HTML 404s
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Ensure any middleware or Express errors return JSON rather than opaque HTML 500s
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Express error:', err);
    if (res.headersSent) return;
    const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;
    res.status(status).json({ error: err?.message || 'Internal server error.' });
  });

  return app;
}
