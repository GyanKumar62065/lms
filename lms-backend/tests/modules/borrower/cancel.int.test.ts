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

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

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

async function stageSlip(agent: any) {
  const pre = await agent
    .post('/api/v1/borrower/salary-slip/presign')
    .send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({
    objectKey: pre.body.objectKey,
    filename: 'slip.pdf',
    mime: 'application/pdf',
    size: 1000,
  });
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

describe('borrower cancel own APPLIED loan → 200 and re-apply', () => {
  let borrower: Awaited<ReturnType<typeof readyBorrower>>;
  let loanId: string;

  beforeAll(async () => {
    borrower = await readyBorrower();
    const loan = await applyLoan(borrower, { productCode: 'PERSONAL' });
    expect(loan.status).toBe(201);
    loanId = loan.body._id;
  });

  it('borrower cancels own APPLIED loan → 200, CANCELLED status', async () => {
    const res = await borrower.post(`/api/v1/borrower/loans/${loanId}/cancel`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('re-apply for the same product after cancelling → 201 (one-active guard ignores CANCELLED)', async () => {
    // re-stage slip (consumed on apply) then re-apply same product
    await stageSlip(borrower);
    const re = await applyLoan(borrower, { productCode: 'PERSONAL' });
    expect(re.status).toBe(201);
  });
});

describe("cannot cancel another borrower's loan → 404", () => {
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

  it("other borrower cannot cancel borrower's loan → 404", async () => {
    const res = await otherBorrower
      .post(`/api/v1/borrower/loans/${loanId}/cancel`)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('cannot cancel a DISBURSED loan → 409', () => {
  let borrower: Awaited<ReturnType<typeof readyBorrower>>;
  let disbursedLoanId: string;

  beforeAll(async () => {
    borrower = await readyBorrower();
    const loan = await applyLoan(borrower, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(loan.status).toBe(201);
    disbursedLoanId = loan.body._id;

    // Sanction + disburse it via admin roles
    const sanctionAgent = await loginAs('sanction@lms.test', 'Sanction@123');
    await sanctionAgent.post(`/api/v1/loans/${disbursedLoanId}/sanction`).send({});
    const disburseAgent = await loginAs('disbursement@lms.test', 'Disburse@123');
    await disburseAgent.post(`/api/v1/loans/${disbursedLoanId}/disburse`).send({});
  });

  it('borrower cannot cancel a DISBURSED loan → 409', async () => {
    const res = await borrower
      .post(`/api/v1/borrower/loans/${disbursedLoanId}/cancel`)
      .send({});
    expect(res.status).toBe(409);
  });
});

describe('borrower cancels own SANCTIONED loan → 200', () => {
  let borrower: Awaited<ReturnType<typeof readyBorrower>>;
  let sanctionedLoanId: string;

  beforeAll(async () => {
    borrower = await readyBorrower();
    const loan = await applyLoan(borrower, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(loan.status).toBe(201);
    sanctionedLoanId = loan.body._id;

    // Sanction it via admin role
    const sanctionAgent = await loginAs('sanction@lms.test', 'Sanction@123');
    await sanctionAgent.post(`/api/v1/loans/${sanctionedLoanId}/sanction`).send({});
  });

  it('borrower cancels own SANCTIONED loan → 200, CANCELLED', async () => {
    const res = await borrower
      .post(`/api/v1/borrower/loans/${sanctionedLoanId}/cancel`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});
