import { Request, Response } from 'express';
import * as service from './payments.service';

export async function list(req: Request, res: Response) {
  res.json(await service.listPayments(req.params.id));
}
export async function create(req: Request, res: Response) {
  const result = await service.recordPayment(req.params.id, req.auth!.user._id.toString(), req.body);
  res.status(201).json(result);
}
