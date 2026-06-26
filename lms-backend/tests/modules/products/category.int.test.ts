import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('product category field', () => {
  it('round-trips an optional category on create + serialize', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.post('/api/v1/admin/products').send({
      code: 'CATTEST', name: 'Cat Test', description: 'd', category: 'Personal', interestRate: 12,
      minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
    });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Personal');
  });

  it('creates a product without category — valid, category absent in response', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.post('/api/v1/admin/products').send({
      code: 'NOCATTEST', name: 'No Cat Test', description: 'd', interestRate: 10,
      minPrincipal: 10000, maxPrincipal: 100000, minTenureDays: 15, maxTenureDays: 180,
      eligibility: { minAge: 21, maxAge: 55, minMonthlySalary: 15000, employmentModes: ['Salaried'] },
    });
    expect(res.status).toBe(201);
    expect(res.body.category).toBeUndefined();
  });
});
