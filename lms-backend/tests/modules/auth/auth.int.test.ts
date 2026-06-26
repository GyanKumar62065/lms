import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { makeKnownCaptcha } from './captcha.helper';
import { signupBorrower } from '../../helpers/signup-borrower';

let mem: MongoMemoryServer;
const app = createApp();
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('auth flow', () => {
  it('signs up a new borrower and returns 201', async () => {
    const agent = request.agent(app);
    const res = await signupBorrower(agent, { email: 'new@x.com' });
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeDefined();
  });
  it('rejects duplicate email with 409', async () => {
    await signupBorrower(request.agent(app), { email: 'dup@x.com' });
    const res = await signupBorrower(request.agent(app), { email: 'dup@x.com' });
    expect(res.status).toBe(409);
  });
  it('logs in seeded admin and exposes permissions on /me', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'Admin@123' });
    expect(login.status).toBe(200);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.role.code).toBe('ADMIN');
    expect(me.body.permissions).toEqual(expect.arrayContaining(['loan:sanction']));
  });
  it('rejects bad credentials with 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('refresh rotates token and /me still works', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'Admin@123' });
    expect(login.status).toBe(200);
    const refresh = await agent.post('/api/v1/auth/refresh');
    expect(refresh.status).toBe(200);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
  });

  it('refresh replay is rejected (token revoked on first use)', async () => {
    // Log in, capture the raw refreshToken value from set-cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@lms.test', password: 'Admin@123' });
    expect(loginRes.status).toBe(200);

    const setCookies: string[] = ((loginRes.headers['set-cookie'] as unknown) as string[]) ?? [];
    const refreshEntry = setCookies.find((c) => c.startsWith('refreshToken='));
    expect(refreshEntry).toBeDefined();
    // Extract just the token value (before the first ';')
    const originalToken = refreshEntry!.split(';')[0]; // e.g. "refreshToken=<value>"

    // First use: should rotate (200)
    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalToken);
    expect(first.status).toBe(200);

    // Replay the SAME original token: should be rejected (401)
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalToken);
    expect(replay.status).toBe(401);
  });

  it('logout then /me returns 401', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'Admin@123' });
    expect(login.status).toBe(200);
    const logoutRes = await agent.post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(204);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('login returns the user role + permissions for role-based redirect', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.role.code).toBe('ADMIN');
    expect(res.body.permissions).toEqual(expect.arrayContaining(['loan:sanction']));
  });

  it('single active session: a new login invalidates the previous session immediately', async () => {
    // Session A
    const a = request.agent(app);
    expect((await a.post('/api/v1/auth/login').send({ email: 'sanction@lms.test', password: 'Sanction@123' })).status).toBe(200);
    expect((await a.get('/api/v1/auth/me')).status).toBe(200); // A is valid

    // Same user logs in elsewhere → Session B
    const b = request.agent(app);
    expect((await b.post('/api/v1/auth/login').send({ email: 'sanction@lms.test', password: 'Sanction@123' })).status).toBe(200);
    expect((await b.get('/api/v1/auth/me')).status).toBe(200); // B is valid

    // A is now superseded — its (still-unexpired) access token is rejected, and its refresh fails too
    expect((await a.get('/api/v1/auth/me')).status).toBe(401);
    expect((await a.post('/api/v1/auth/refresh')).status).toBe(401);
  });
});
