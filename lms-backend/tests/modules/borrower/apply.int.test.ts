import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';
import { applyLoan } from '../../helpers/apply-loan';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/upload-url'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/download-url'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function readyBorrower() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
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

describe('apply for loan', () => {
  it('creates an APPLIED loan with correct math and a loanRef', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('APPLIED');
    expect(res.body.loanRef).toMatch(/^LMS-\d{4}-\d{6}$/);
    expect(res.body.principal).toBe(20000000); // paise
    expect(res.body.simpleInterest).toBe(394521);
    expect(res.body.totalRepayment).toBe(20000000 + 394521);
  });
  it('blocks apply when slip not staged with 409', async () => {
    const agent = request.agent(app);
    await signupBorrower(agent);
    await agent.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
    const res = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
    expect(res.status).toBe(409);
  });
  it('lists only own loans', async () => {
    const agent = await readyBorrower();
    await applyLoan(agent, { principal: 100000, tenureDays: 90 });
    const res = await agent.get('/api/v1/borrower/loans');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
  it('returns 404 (not 500) when loan id is a malformed ObjectId', async () => {
    const agent = await readyBorrower();
    const res = await agent.get('/api/v1/borrower/loans/not-a-valid-id');
    expect(res.status).toBe(404);
  });
});
