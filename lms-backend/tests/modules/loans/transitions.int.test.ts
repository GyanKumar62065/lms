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
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
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

describe('loan transitions', () => {
  it('sanction then disburse follows the state machine', async () => {
    const loan = await createAppliedLoan();
    const sanction = await loginAs('sanction@lms.test', 'Sanction@123');
    const s = await sanction.post(`/api/v1/loans/${loan._id}/sanction`).send({});
    expect(s.status).toBe(200);
    expect(s.body.status).toBe('SANCTIONED');

    const disb = await loginAs('disbursement@lms.test', 'Disburse@123');
    const d = await disb.post(`/api/v1/loans/${loan._id}/disburse`).send({});
    expect(d.status).toBe(200);
    expect(d.body.status).toBe('DISBURSED');
  });
  it('rejects illegal transition (disburse an APPLIED loan) with 409', async () => {
    const loan = await createAppliedLoan();
    const disb = await loginAs('disbursement@lms.test', 'Disburse@123');
    const d = await disb.post(`/api/v1/loans/${loan._id}/disburse`).send({});
    expect(d.status).toBe(409);
  });
  it('reject requires a reason (422) and records it', async () => {
    const loan = await createAppliedLoan();
    const sanction = await loginAs('sanction@lms.test', 'Sanction@123');
    const bad = await sanction.post(`/api/v1/loans/${loan._id}/reject`).send({});
    expect(bad.status).toBe(422);
    const ok = await sanction.post(`/api/v1/loans/${loan._id}/reject`).send({ reason: 'Insufficient income proof' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('REJECTED');
    expect(ok.body.sanction.reason).toBe('Insufficient income proof');
  });
  it('denies disbursement role from sanctioning with 403', async () => {
    const loan = await createAppliedLoan();
    const disb = await loginAs('disbursement@lms.test', 'Disburse@123');
    const res = await disb.post(`/api/v1/loans/${loan._id}/sanction`).send({});
    expect(res.status).toBe(403);
  });
});
