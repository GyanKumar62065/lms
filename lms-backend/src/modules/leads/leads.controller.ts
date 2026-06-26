import { Request, Response } from 'express';
import * as service from './leads.service';
import { LeadStage } from './leads.service';

export async function list(req: Request, res: Response) {
  const { page, limit, stage } = req.query as { page?: number; limit?: number; stage?: LeadStage };
  res.json(await service.listLeads({ page, limit, stage }));
}
export async function detail(req: Request, res: Response) {
  res.json(await service.getLead(req.params.userId));
}
export async function contacted(req: Request, res: Response) {
  res.json(await service.markContacted(req.params.userId, req.auth!.user._id.toString(), req.body?.note));
}
