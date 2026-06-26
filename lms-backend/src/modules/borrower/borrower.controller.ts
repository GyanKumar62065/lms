import { Request, Response } from 'express';
import * as service from './borrower.service';

export async function putProfile(req: Request, res: Response) {
  const profile = await service.upsertProfile(req.auth!.user._id.toString(), req.body);
  res.json({ eligibility: profile.eligibility });
}
export async function getProfile(req: Request, res: Response) {
  const profile = await service.getProfile(req.auth!.user._id.toString());
  res.json(profile);
}
export async function presignSlip(req: Request, res: Response) {
  res.json(await service.presignSlip(req.auth!.user._id.toString(), req.body));
}
export async function stageSlip(req: Request, res: Response) {
  await service.stageSlip(req.auth!.user._id.toString(), req.body);
  res.json({ status: 'staged' });
}
export async function apply(req: Request, res: Response) {
  const loan = await service.applyForLoan(req.auth!.user._id.toString(), req.body);
  res.status(201).json(loan);
}
export async function listLoans(req: Request, res: Response) {
  res.json(await service.listOwnLoans(req.auth!.user._id.toString()));
}
export async function getLoan(req: Request, res: Response) {
  res.json(await service.getOwnLoan(req.auth!.user._id.toString(), req.params.id));
}
export async function cancelLoan(req: Request, res: Response) {
  const loan = await service.cancelOwnLoan(
    req.auth!.user._id.toString(),
    req.params.id,
    req.body?.reason,
  );
  res.json(loan);
}
export async function document(req: Request, res: Response) {
  res.json(await service.getOwnLoanDocument(req.auth!.user._id.toString(), req.params.id));
}
