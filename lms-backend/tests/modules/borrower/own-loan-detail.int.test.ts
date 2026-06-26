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
  return agent;
}

async function disburseLoan(loanId: string) {
  const sanctionAgent = request.agent(app);
  await sanctionAgent.post('/api/v1/auth/login').send({ email: 'sanction@lms.test', password: 'Sanction@123' });
  const sanctionRes = await sanctionAgent.post(`/api/v1/loans/${loanId}/sanction`).send({});
  expect(sanctionRes.status).toBe(200);

  const disbAgent = request.agent(app);
  await disbAgent.post('/api/v1/auth/login').send({ email: 'disbursement@lms.test', password: 'Disburse@123' });
  const disbRes = await disbAgent.post(`/api/v1/loans/${loanId}/disburse`).send({});
  expect(disbRes.status).toBe(200);
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

describe('GET /borrower/loans/:id — own loan detail returns {loan, payments}', () => {
  let borrower: Awaited<ReturnType<typeof readyBorrower>>;
  let otherBorrower: Awaited<ReturnType<typeof readyBorrower>>;
  let loanId: string;

  beforeAll(async () => {
    borrower = await readyBorrower();
    otherBorrower = await readyBorrower();
    const loan = await applyLoan(borrower, { productCode: 'PERSONAL' });
    expect(loan.status).toBe(201);
    loanId = loan.body._id;
  });

  it('returns {loan, payments} for own APPLIED loan with empty payments array', async () => {
    const res = await borrower.get(`/api/v1/borrower/loans/${loanId}`);
    expect(res.status).toBe(200);
    expect(res.body.loan._id).toBe(loanId);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.payments).toHaveLength(0);
  });

  it('404 for a loan the borrower does not own', async () => {
    const res = await otherBorrower.get(`/api/v1/borrower/loans/${loanId}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /borrower/loans/:id — disbursed loan with payments, rupees + sorted, no staff PII', () => {
  let borrower: Awaited<ReturnType<typeof readyBorrower>>;
  let loanId: string;

  beforeAll(async () => {
    borrower = await readyBorrower();
    const loan = await applyLoan(borrower, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(loan.status).toBe(201);
    loanId = loan.body._id;

    await disburseLoan(loanId);

    // Record two payments via collection agent with distinct paidAt timestamps (after disbursement)
    const colAgent = request.agent(app);
    await colAgent.post('/api/v1/auth/login').send({ email: 'collection@lms.test', password: 'Collect@123' });

    const now = Date.now();
    const t1 = new Date(now).toISOString();
    const t2 = new Date(now + 1000).toISOString();
    const p1 = await colAgent.post(`/api/v1/loans/${loanId}/payments`).send({
      utr: `UTR-DET-A-${now}`,
      amount: 1000,
      paidAt: t1,
    });
    expect(p1.status).toBe(201);
    const p2 = await colAgent.post(`/api/v1/loans/${loanId}/payments`).send({
      utr: `UTR-DET-B-${now}`,
      amount: 2000,
      paidAt: t2,
    });
    expect(p2.status).toBe(201);
  });

  it('returns {loan, payments} for own disbursed loan, payments rupees + sorted, no staff name', async () => {
    const res = await borrower.get(`/api/v1/borrower/loans/${loanId}`);
    expect(res.status).toBe(200);
    expect(res.body.loan._id).toBe(loanId);
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.payments.length).toBeGreaterThanOrEqual(2);

    // amounts are in rupees (not paise) — 1000 rupees recorded → expect 1000, not 100000
    const firstPayment = res.body.payments[0];
    expect(firstPayment.amount).toBe(1000); // rupees
    expect(firstPayment).toHaveProperty('_id');
    expect(firstPayment).toHaveProperty('utr');
    expect(firstPayment).toHaveProperty('paidAt');
    // Must NOT expose recordedBy (staff PII)
    expect(firstPayment).not.toHaveProperty('recordedBy');

    // Sorted ascending by paidAt
    const dates = res.body.payments.map((p: any) => new Date(p.paidAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe('GET /borrower/loans — list endpoint shape unchanged', () => {
  it('returns {data, pagination} shape (list endpoint unchanged)', async () => {
    const agent = await readyBorrower();
    await applyLoan(agent, { productCode: 'PERSONAL' });
    const res = await agent.get('/api/v1/borrower/loans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });
});
