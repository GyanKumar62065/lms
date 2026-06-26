import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as c from './rbac.controller';

export const rbacRouter = Router();
rbacRouter.use(authenticate, authorize('rbac:read'));
rbacRouter.get('/roles', asyncHandler(c.listRoles));
