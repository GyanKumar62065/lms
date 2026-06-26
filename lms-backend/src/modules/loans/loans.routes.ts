import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { rejectDto, cancelDto, listLoansQuery } from './loans.dto';
import * as c from './loans.controller';
import { paymentsRouter } from '../payments/payments.routes';

export const loansRouter = Router();
loansRouter.use(authenticate);
loansRouter.get('/', authorize('loan:read:all'), validate({ query: listLoansQuery }), asyncHandler(c.list));
loansRouter.get('/:id', authorize('loan:read:all'), asyncHandler(c.detail));
loansRouter.get('/:id/document', authorize('loan:read:all'), asyncHandler(c.document));
loansRouter.post('/:id/sanction', authorize('loan:sanction'), asyncHandler(c.sanction));
loansRouter.post('/:id/reject', authorize('loan:sanction'), validate({ body: rejectDto }), asyncHandler(c.reject));
loansRouter.post('/:id/disburse', authorize('loan:disburse'), asyncHandler(c.disburse));
loansRouter.post('/:id/cancel', authorize('loan:cancel'), validate({ body: cancelDto }), asyncHandler(c.cancel));
loansRouter.use('/:id/payments', paymentsRouter);
