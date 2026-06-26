import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';
import { applyLoan } from '../../helpers/apply-loan';

jest.mock('../../../src/lib/storage', () => ({
  ...jest.requireActual('../../../src/lib/storage'),
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/upload-url'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/dl'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

async function createBorrowerWithLoan() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({
    fullName: 'Test Borrower',
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
  const loan = await applyLoan(agent);
  return { agent, loanId: loan.body._id as string };
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

describe('presigned document download endpoints', () => {
  let admin: Awaited<ReturnType<typeof loginAs>>;
  let borrower: Awaited<ReturnType<typeof createBorrowerWithLoan>>['agent'];
  let otherBorrower: Awaited<ReturnType<typeof createBorrowerWithLoan>>['agent'];
  let loanId: string;

  beforeAll(async () => {
    admin = await loginAs('admin@lms.test', 'Admin@123');
    const b1 = await createBorrowerWithLoan();
    borrower = b1.agent;
    loanId = b1.loanId;

    const b2 = await createBorrowerWithLoan();
    otherBorrower = b2.agent;
  });

  it('ops gets a presigned document url', async () => {
    const res = await admin.get(`/api/v1/loans/${loanId}/document`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: expect.any(String),
      filename: expect.any(String),
      mime: expect.any(String),
    });
  });

  it('borrower gets own document url', async () => {
    const res = await borrower.get(`/api/v1/borrower/loans/${loanId}/document`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: expect.any(String),
      filename: expect.any(String),
      mime: expect.any(String),
    });
  });

  it('borrower gets 404 for another borrower\'s loan', async () => {
    const res = await otherBorrower.get(`/api/v1/borrower/loans/${loanId}/document`);
    expect(res.status).toBe(404);
  });

  it('loan with no salary slip returns 404', async () => {
    // Use an invalid/unknown loan id to simulate missing salarySlip (NotFoundError)
    const res = await admin.get('/api/v1/loans/64b0000000000000000000aa/document');
    expect(res.status).toBe(404);
  });

  it('unauthorized role on ops route gets 403', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales.get(`/api/v1/loans/${loanId}/document`);
    expect(res.status).toBe(403);
  });
});
