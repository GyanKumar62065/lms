import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { listLeadsQuery } from './leads.dto';
import * as c from './leads.controller';

export const leadsRouter = Router();
leadsRouter.use(authenticate, authorize('lead:read'));
leadsRouter.get('/', validate({ query: listLeadsQuery }), asyncHandler(c.list));
leadsRouter.get('/:userId', asyncHandler(c.detail));
leadsRouter.patch('/:userId/contacted', asyncHandler(c.contacted));
