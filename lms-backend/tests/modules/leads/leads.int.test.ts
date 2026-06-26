import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';

let mem: MongoMemoryServer;
const app = createApp();

async function salesAgent() {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email: 'sales@lms.test', password: 'Sales@123' });
  return agent;
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('leads', () => {
  it('lists a freshly registered borrower as REGISTERED stage', async () => {
    const borrower = request.agent(app);
    await signupBorrower(borrower, { email: 'lead1@x.com' });
    const sales = await salesAgent();
    const res = await sales.get('/api/v1/leads');
    expect(res.status).toBe(200);
    const found = res.body.data.find((l: any) => l.email === 'lead1@x.com');
    expect(found.stage).toBe('REGISTERED');
  });
  it('denies a borrower access to leads with 403', async () => {
    const borrower = request.agent(app);
    await signupBorrower(borrower, { email: 'lead2@x.com' });
    const res = await borrower.get('/api/v1/leads');
    expect(res.status).toBe(403);
  });
});
