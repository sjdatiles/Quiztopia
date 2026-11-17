import type { IncomingMessage, ServerResponse } from 'node:http';
import { createExpressApp } from './app.ts';

const app = createExpressApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Reconstruct original /api/* path when Vercel rewrites /api/(.*) -> /api/index.js?__path=$1
    if (req.url) {
      try {
        const parsed = new URL(req.url, 'http://localhost');
        const rewrittenPath = parsed.searchParams.get('__path');
        if (rewrittenPath !== null) {
          parsed.searchParams.delete('__path');
          const qs = parsed.searchParams.toString();
          const cleanPath = rewrittenPath.replace(/^\/+/, '');
          req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
        }
      } catch {
        // Keep original req.url if URL parsing fails
      }
    }

    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (err: any) {
    console.error('Vercel handler fatal error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err?.message || 'Serverless handler error.' }));
    }
  }
}
