import { Request, Response } from 'express';
import * as service from './product.service';
import { serializeProduct } from './product.serializer';

export async function listPublicProducts(_req: Request, res: Response) {
  const products = await service.listProducts(false);
  res.json({ data: products.map(serializeProduct) });
}
export async function listProducts(_req: Request, res: Response) {
  const products = await service.listProducts(true);
  res.json({ data: products.map(serializeProduct) });
}
export async function getProduct(req: Request, res: Response) {
  const product = await service.getProductByCode(req.params.code);
  res.json(serializeProduct(product));
}
export async function createProduct(req: Request, res: Response) {
  const product = await service.createProduct(req.body);
  res.status(201).json(serializeProduct(product));
}
export async function updateProduct(req: Request, res: Response) {
  const product = await service.updateProduct(req.params.id, req.body);
  res.json(serializeProduct(product));
}
export async function activateProduct(req: Request, res: Response) {
  const product = await service.setProductStatus(req.params.id, 'ACTIVE');
  res.json(serializeProduct(product));
}
export async function deactivateProduct(req: Request, res: Response) {
  const product = await service.setProductStatus(req.params.id, 'INACTIVE');
  res.json(serializeProduct(product));
}
