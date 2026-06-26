import { Types } from 'mongoose';
import { Event } from '../../models/event.model';

export async function ingestEvents(params: {
  events: { name: string; path?: string; referrer?: string; utm?: any; ts?: Date }[];
  sessionId: string; userId?: string; userAgent?: string; ip?: string;
}) {
  const docs = params.events.map((e) => ({
    name: e.name, path: e.path, referrer: e.referrer, utm: e.utm,
    sessionId: params.sessionId,
    userId: params.userId ? new Types.ObjectId(params.userId) : undefined,
    userAgent: params.userAgent, ip: params.ip, ts: e.ts ?? new Date(),
  }));
  await Event.insertMany(docs, { ordered: false });
}
