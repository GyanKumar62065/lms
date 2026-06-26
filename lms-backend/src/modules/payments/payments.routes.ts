import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { recordPaymentDto } from './payments.dto';
import * as c from './payments.controller';

// mergeParams so `:id` (loan id) from the parent loans router is available
export const paymentsRouter = Router({ mergeParams: true });
paymentsRouter.get('/', authorize('payment:read'), asyncHandler(c.list));
paymentsRouter.post('/', authorize('payment:create'), validate({ body: recordPaymentDto }), asyncHandler(c.create));
