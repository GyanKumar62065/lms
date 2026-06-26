import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { Event } from '../../../src/models/event.model';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('POST /track', () => {
  it('ingests events, sets a sid cookie, returns 202', async () => {
    const res = await request(app).post('/api/v1/track').send({ events: [{ name: 'landing_view', path: '/' }] });
    expect(res.status).toBe(202);
    const cookies: string[] = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    expect(cookies.join()).toMatch(/sid=/);
    const e = await Event.findOne({ name: 'landing_view' });
    expect(e).toBeTruthy();
    expect(e!.sessionId).toBeTruthy();
  });
  it('reuses an existing sid cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/track').send({ events: [{ name: 'page_view', path: '/a' }] });
    await agent.post('/api/v1/track').send({ events: [{ name: 'page_view', path: '/b' }] });
    const sids = await Event.find({ name: 'page_view' }).distinct('sessionId');
    expect(sids.length).toBe(1); // same session across both calls
  });
});
