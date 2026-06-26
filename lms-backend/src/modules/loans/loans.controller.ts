import { Request, Response } from 'express';
import * as service from './loans.service';

export async function list(req: Request, res: Response) {
  res.json(await service.listLoans(req.query as any));
}
export async function detail(req: Request, res: Response) {
  res.json(await service.getLoan(req.params.id));
}
export async function sanction(req: Request, res: Response) {
  res.json(await service.sanction(req.params.id, req.auth!.user._id.toString()));
}
export async function reject(req: Request, res: Response) {
  res.json(await service.reject(req.params.id, req.auth!.user._id.toString(), req.body.reason));
}
export async function disburse(req: Request, res: Response) {
  res.json(await service.disburse(req.params.id, req.auth!.user._id.toString()));
}
export async function cancel(req: Request, res: Response) {
  res.json(await service.cancel(req.params.id, req.auth!.user._id.toString(), req.body?.reason));
}
export async function document(req: Request, res: Response) {
  res.json(await service.getLoanDocument(req.params.id));
}
