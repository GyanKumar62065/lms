import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';

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

describe('rbac admin', () => {
  it('admin can read roles + permission mappings', async () => {
    const admin = request.agent(app);
    await admin.post('/api/v1/auth/login').send({ email: 'admin@lms.test', password: 'Admin@123' });
    const res = await admin.get('/api/v1/admin/roles');
    expect(res.status).toBe(200);
    const sanction = res.body.data.find((r: any) => r.code === 'SANCTION');
    expect(sanction.permissions).toEqual(expect.arrayContaining(['loan:sanction']));
  });
  it('sales (no rbac:read) gets 403', async () => {
    const sales = request.agent(app);
    await sales.post('/api/v1/auth/login').send({ email: 'sales@lms.test', password: 'Sales@123' });
    const res = await sales.get('/api/v1/admin/roles');
    expect(res.status).toBe(403);
  });
});
