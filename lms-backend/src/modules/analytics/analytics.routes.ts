import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../middleware/async-handler';
import { optionalAuth } from '../../middleware/optional-auth';
import { validate } from '../../middleware/validate';
import { trackDto } from './analytics.dto';
import * as c from './analytics.controller';

export const analyticsRouter = Router();
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
analyticsRouter.post('/', trackLimiter, optionalAuth, validate({ body: trackDto }), asyncHandler(c.track));
