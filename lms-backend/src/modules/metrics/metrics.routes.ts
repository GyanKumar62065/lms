import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as c from './metrics.controller';

export const metricsRouter = Router();
metricsRouter.use(authenticate, authorize('metrics:read'));
metricsRouter.get('/metrics', asyncHandler(c.metrics));
