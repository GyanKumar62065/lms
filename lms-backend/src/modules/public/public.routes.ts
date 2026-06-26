import { Router } from 'express';
import { getPublicConfig } from './public.controller';
import { asyncHandler } from '../../middleware/async-handler';
import { listPublicProducts } from '../products/product.controller';
export const publicRouter = Router();
publicRouter.get('/config', getPublicConfig);
publicRouter.get('/products', asyncHandler(listPublicProducts));
