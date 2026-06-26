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

async function createAppliedLoan() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({
    fullName: 'Rahul',
    pan: 'ABCDE1234F',
    dob: '1995-04-12',
    monthlySalary: 45000,
    employmentMode: 'Salaried',
  });
  const pre = await agent
    .post('/api/v1/borrower/salary-slip/presign')
    .send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({
    objectKey: pre.body.objectKey,
    filename: 'slip.pdf',
    mime: 'application/pdf',
    size: 1000,
  });
  const loan = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
  return loan.body;
}

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

describe('loan cancel endpoint', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let appliedLoanId: string;
  let disbursedLoanId: string;

  beforeAll(async () => {
    admin = await loginAs('admin@lms.test', 'Admin@123');

    // Create an APPLIED loan for successful cancel test
    const appliedLoan = await createAppliedLoan();
    appliedLoanId = appliedLoan._id;

    // Create a DISBURSED loan for the 409 test
    const loanForDisburse = await createAppliedLoan();
    const sanctionAgent = await loginAs('sanction@lms.test', 'Sanction@123');
    await sanctionAgent.post(`/api/v1/loans/${loanForDisburse._id}/sanction`).send({});
    const disburseAgent = await loginAs('disbursement@lms.test', 'Disburse@123');
    await disburseAgent.post(`/api/v1/loans/${loanForDisburse._id}/disburse`).send({});
    disbursedLoanId = loanForDisburse._id;
  });

  it('admin cancels an APPLIED loan → 200, CANCELLED status, cancellation subdoc set, statusHistory entry', async () => {
    const res = await admin
      .post(`/api/v1/loans/${appliedLoanId}/cancel`)
      .send({ reason: 'duplicate request' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancellation).toBeDefined();
    expect(res.body.cancellation.reason).toBe('duplicate request');
    expect(res.body.cancellation.at).toBeDefined();
    const lastHistory = res.body.statusHistory[res.body.statusHistory.length - 1];
    expect(lastHistory.to).toBe('CANCELLED');
    expect(lastHistory.from).toBe('APPLIED');
  });

  it('rejects cancel of a DISBURSED loan with 409', async () => {
    const res = await admin
      .post(`/api/v1/loans/${disbursedLoanId}/cancel`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('denies a role without loan:cancel (sales) with 403', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales
      .post(`/api/v1/loans/${appliedLoanId}/cancel`)
      .send({ reason: 'unauthorized attempt' });
    expect(res.status).toBe(403);
  });
});
