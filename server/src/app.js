import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((item) => item.trim()) }));
  app.use(express.json({ limit: '256kb' }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many requests' } },
  }));
  const strict = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many run requests' } },
  });
  app.use('/api/incidents/:id/run', strict);
  app.use('/api/demo/run', strict);
  app.use('/api', apiRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
