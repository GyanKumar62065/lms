import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import './models'; // register ALL mongoose models (needed for populate of string-ref'd models like Permission)
import { router, apiRouter } from './routes';
import { errorHandler } from './middleware/error-handler';

export function createApp(): Express {
  const app = express();
  if (config.trustProxy) {
    const tp = config.trustProxy;
    app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp);
  }
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (config.nodeEnv !== 'test') app.use(pinoHttp({ logger }));
  // Rate-limit only the credential/refresh endpoints. NOT /auth/me or /auth/captcha — those are
  // hit on every page load (getSession), so limiting them caused spurious lockouts/logouts.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
  app.use(['/api/v1/auth/login', '/api/v1/auth/signup', '/api/v1/auth/refresh'], authLimiter);
  app.use(router);
  app.use('/api/v1', apiRouter);
  app.use(errorHandler);
  return app;
}
