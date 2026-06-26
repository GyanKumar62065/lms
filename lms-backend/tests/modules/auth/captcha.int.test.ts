import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /auth/captcha', () => {
  it('returns an svg + id', async () => {
    const res = await request(app).get('/api/v1/auth/captcha');
    expect(res.status).toBe(200);
    expect(res.body.captchaId).toBeDefined();
    expect(res.body.svg).toContain('<svg');
  });
});

// helper other tests reuse: create a captcha with a known answer
export { makeKnownCaptcha } from './captcha.helper';
