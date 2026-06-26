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

async function disbursedLoan() {
  const borrower = request.agent(app);
  await signupBorrower(borrower);
  await borrower.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await borrower.post('/api/v1/borrower/salary-slip/presign').send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  await borrower.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  const loan = (await applyLoan(borrower, { principal: 200000, tenureDays: 60 })).body;

  const sanction = request.agent(app);
  await sanction.post('/api/v1/auth/login').send({ email: 'sanction@lms.test', password: 'Sanction@123' });
  await sanction.post(`/api/v1/loans/${loan._id}/sanction`).send({});
  const disb = request.agent(app);
  await disb.post('/api/v1/auth/login').send({ email: 'disbursement@lms.test', password: 'Disburse@123' });
  await disb.post(`/api/v1/loans/${loan._id}/disburse`).send({});
  return loan;
}
async function collectionAgent() {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email: 'collection@lms.test', password: 'Collect@123' });
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

describe('payments', () => {
  it('records a partial payment and reduces outstanding', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr: `UTR-${Date.now()}`, amount: 50000, paidAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.loan.amountPaid).toBe(5000000);
    expect(res.body.loan.outstanding).toBe(loan.totalRepayment - 5000000);
    expect(res.body.loan.status).toBe('DISBURSED');
  });
  it('auto-closes when fully paid', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    const fullRupees = loan.totalRepayment / 100;
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr: `UTR-${Date.now()}-full`, amount: fullRupees, paidAt: new Date().toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.loan.status).toBe('CLOSED');
    expect(res.body.loan.outstanding).toBe(0);
  });
  it('rejects overpayment with 422', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr: `UTR-${Date.now()}-over`, amount: 999999, paidAt: new Date().toISOString() });
    expect(res.status).toBe(422);
  });
  it('rejects duplicate UTR with 409', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    const utr = `UTR-DUP-${Date.now()}`;
    await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr, amount: 1000, paidAt: new Date().toISOString() });
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr, amount: 1000, paidAt: new Date().toISOString() });
    expect(res.status).toBe(409);
  });
  it('rejects paidAt before disbursement with 422', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    // Use a date clearly in the past (before any real disbursement could have happened)
    const pastDate = new Date('2020-01-01T00:00:00.000Z').toISOString();
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr: `UTR-PAST-${Date.now()}`, amount: 1000, paidAt: pastDate });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/before disbursement/i);
  });
  it('accepts paidAt equal to or after disbursement', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    // Use current time (disbursement just happened, so now >= disbursedAt)
    const res = await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr: `UTR-NOW-${Date.now()}`, amount: 1000, paidAt: new Date().toISOString() });
    expect(res.status).toBe(201);
  });
  it('GET /loans/:id/payments returns data, outstanding, and totalRepayment', async () => {
    const loan = await disbursedLoan();
    const col = await collectionAgent();
    const utr = `UTR-LIST-${Date.now()}`;
    await col.post(`/api/v1/loans/${loan._id}/payments`).send({ utr, amount: 50000, paidAt: new Date().toISOString() });
    const res = await col.get(`/api/v1/loans/${loan._id}/payments`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].utr).toBe(utr);
    expect(res.body.data[0].amount).toBe(5000000);
    expect(res.body.totalRepayment).toBe(loan.totalRepayment);
    expect(res.body.outstanding).toBe(loan.totalRepayment - 5000000);
  });
});
