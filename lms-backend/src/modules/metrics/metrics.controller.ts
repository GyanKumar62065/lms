import { Request, Response } from 'express';
import * as service from './metrics.service';

export async function metrics(_req: Request, res: Response) {
  res.json(await service.getMetrics());
}
