import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { attachSession } from './auth.ts';
import { authRouter } from './routes/authRoutes.ts';
import { teacherRouter } from './routes/teacherRoutes.ts';
import { teamRouter } from './routes/teamRoutes.ts';
import { ensureSeeded } from './seed.ts';

export function createExpressApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    if (req.body !== undefined && typeof req.body === 'object') {
      next();
      return;
    }
    express.json({ limit: '1mb' })(req, res, next);
  });
  app.use(cookieParser());
  app.use(attachSession);

  // Health probe
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureSeeded();
      res.json({ ok: true, service: 'quiztopia' });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({ ok: false, error: 'Database initialization failed.' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/team', teamRouter);

  // Always return JSON for unmatched /api/* routes so clients never get opaque HTML 404s
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  return app;
}
