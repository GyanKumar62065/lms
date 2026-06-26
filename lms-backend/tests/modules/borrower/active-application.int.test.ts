import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';
import { applyLoan } from '../../helpers/apply-loan';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/u'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/d'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function readyBorrower() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'B X', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
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

describe('one active application', () => {
  it('blocks a second apply while one is active (409)', async () => {
    const agent = await readyBorrower();
    const first = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    // re-stage a slip then try again (profile slip was consumed on apply)
    const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
    await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
    const second = await applyLoan(agent, { principal: 100000, tenureDays: 90 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
    expect(second.body.error.details.loanRef).toMatch(/^LMS-/);
    expect(second.body.error.details.productCode).toBe('PERSONAL');
  });
});
