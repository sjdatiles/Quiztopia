import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { attachSession, parseCookieHeader, SESSION_COOKIE_NAME, verifySessionToken } from './server/auth.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { teacherRouter } from './server/routes/teacherRoutes.ts';
import { teamRouter } from './server/routes/teamRoutes.ts';
import { attachQuizWebSocketServer, registerQuizClient } from './server/services/quizEngine.ts';
import { ensureSeeded } from './server/seed.ts';

export async function createServerApp(options?: { skipFrontend?: boolean }) {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachSession);

  // Health probe
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureSeeded();
      res.json({ ok: true, service: 'quiztopia' });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({ ok: false });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/team', teamRouter);

  // WebSocket Server for Live Classroom Quiz Sync on port 3000 (/ws/quiz)
  const wss = new WebSocketServer({ noServer: true });
  attachQuizWebSocketServer(wss);

  server.on('upgrade', (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (reqUrl.pathname !== '/ws/quiz') {
        socket.destroy();
        return;
      }

      const cookies = parseCookieHeader(req.headers.cookie);
      const user = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
      const sessionId = reqUrl.searchParams.get('sessionId') || '';

      if (!user || !sessionId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        registerQuizClient(sessionId, ws, user);
      });
    } catch {
      socket.destroy();
    }
  });

  if (!options?.skipFrontend) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return { app, server };
}

// Only bind port when executed directly as server entrypoint
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  const PORT = Number(process.env.PORT || 3000);
  createServerApp()
    .then(({ server }) => {
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Quiztopia server running on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start Quiztopia server:', err);
      process.exit(1);
    });
}
