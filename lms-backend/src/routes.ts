import { Router } from 'express';
import mongoose from 'mongoose';
// module routers are added in later tasks
export const router = Router();

router.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
router.get('/readyz', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
});

export const apiRouter = Router(); // mounted at /api/v1; module routers attach here

import { authRouter } from './modules/auth/auth.routes';
apiRouter.use('/auth', authRouter);

import { borrowerRouter } from './modules/borrower/borrower.routes';
apiRouter.use('/borrower', borrowerRouter);

import { leadsRouter } from './modules/leads/leads.routes';
apiRouter.use('/leads', leadsRouter);

import { loansRouter } from './modules/loans/loans.routes';
apiRouter.use('/loans', loansRouter);

import { rbacRouter } from './modules/rbac/rbac.routes';
apiRouter.use('/admin', rbacRouter);

import { analyticsRouter } from './modules/analytics/analytics.routes';
apiRouter.use('/track', analyticsRouter);

import { publicRouter } from './modules/public/public.routes';
apiRouter.use('/public', publicRouter);

import { productsRouter, adminProductsRouter } from './modules/products/product.routes';
apiRouter.use('/products', productsRouter);
apiRouter.use('/admin/products', adminProductsRouter);

import { metricsRouter } from './modules/metrics/metrics.routes';
apiRouter.use('/admin', metricsRouter);
