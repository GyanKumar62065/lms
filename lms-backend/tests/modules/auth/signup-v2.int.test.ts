import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { makeKnownCaptcha } from './captcha.helper';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); await runSeed(); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

const base = (cap: any, over: any = {}) => ({
  firstName: 'Rahul', lastName: 'K', email: `r${Math.random()}@x.com`, phone: `9${Math.floor(100000000 + Math.random()*899999999)}`,
  password: 'Passw0rd!', ...cap, ...over,
});

describe('signup v2', () => {
  it('creates a user with names+phone and sets fullName', async () => {
    const cap = await makeKnownCaptcha();
    const res = await request(app).post('/api/v1/auth/signup').send(base(cap));
    expect(res.status).toBe(201);
    const u = await User.findOne({ email: res.body.email });
    expect(u!.fullName).toBe('Rahul K');
    expect(u!.phone).toMatch(/^[6-9]\d{9}$/);
  });
  it('rejects a wrong captcha with 422', async () => {
    const cap = await makeKnownCaptcha();
    const res = await request(app).post('/api/v1/auth/signup').send(base({ captchaId: cap.captchaId, captchaText: 'WRONG' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CAPTCHA_INVALID');
  });
  it('rejects a duplicate phone with 409', async () => {
    const phone = '9811111111';
    await request(app).post('/api/v1/auth/signup').send(base(await makeKnownCaptcha(), { phone }));
    const res = await request(app).post('/api/v1/auth/signup').send(base(await makeKnownCaptcha(), { phone }));
    expect(res.status).toBe(409);
  });
});
