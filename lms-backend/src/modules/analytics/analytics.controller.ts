import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ingestEvents } from './analytics.service';
import { config } from '../../config';

export async function track(req: Request, res: Response) {
  let sid = req.cookies?.sid as string | undefined;
  if (!sid) {
    sid = randomUUID();
    res.cookie('sid', sid, { httpOnly: false, secure: config.cookie.secure, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  }
  // await the ingest so events are persisted, but swallow errors so DB failures never surface to the client
  await ingestEvents({
    events: req.body.events,
    sessionId: sid,
    userId: req.auth?.user?._id?.toString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  }).catch(() => {});
  res.status(202).json({ ok: true });
}
