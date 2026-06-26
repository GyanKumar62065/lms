import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createProductDto, updateProductDto } from './product.dto';
import * as c from './product.controller';

// authed read (ops + admin): /api/v1/products
export const productsRouter = Router();
productsRouter.use(authenticate, authorize('product:read'));
productsRouter.get('/', asyncHandler(c.listProducts));
productsRouter.get('/:code', asyncHandler(c.getProduct));

// admin write: /api/v1/admin/products
export const adminProductsRouter = Router();
adminProductsRouter.use(authenticate, authorize('product:manage'));
adminProductsRouter.post('/', validate({ body: createProductDto }), asyncHandler(c.createProduct));
adminProductsRouter.patch('/:id', validate({ body: updateProductDto }), asyncHandler(c.updateProduct));
adminProductsRouter.post('/:id/activate', asyncHandler(c.activateProduct));
adminProductsRouter.post('/:id/deactivate', asyncHandler(c.deactivateProduct));
