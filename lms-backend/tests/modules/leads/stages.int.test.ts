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

let aEmail: string; // REGISTERED (just signed up)
let bEmail: string; // SLIP_UPLOADED (slip staged, no loan — drop-off)
let cEmail: string; // APPLIED (has a loan)
let dEmail: string; // DETAILS_SUBMITTED (profile, BRE pass, no slip)
let eEmail: string; // BRE_REJECTED

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

async function adminAgent() {
  return loginAs('admin@lms.test', 'Admin@123');
}

async function salesAgent() {
  return loginAs('sales@lms.test', 'Sales@123');
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();

  // Borrower A: REGISTERED (just signed up)
  {
    const agent = request.agent(app);
    const ts = `a-${Date.now()}`;
    aEmail = `stage-a-${ts}@x.com`;
    await signupBorrower(agent, { email: aEmail });
  }

  // Borrower D: DETAILS_SUBMITTED (profile submitted, BRE pass, no slip)
  {
    const agent = request.agent(app);
    const ts = `d-${Date.now()}`;
    dEmail = `stage-d-${ts}@x.com`;
    await signupBorrower(agent, { email: dEmail });
    await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Details User',
      pan: 'ABCDE1234F',
      dob: '1995-04-12',
      monthlySalary: 45000,
      employmentMode: 'Salaried',
    });
  }

  // Borrower E: BRE_REJECTED (profile submitted, BRE fail)
  {
    const agent = request.agent(app);
    const ts = `e-${Date.now()}`;
    eEmail = `stage-e-${ts}@x.com`;
    await signupBorrower(agent, { email: eEmail });
    // BRE fail: salary too low
    await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Rejected User',
      pan: 'ABCDE1234F',
      dob: '1995-04-12',
      monthlySalary: 1000,
      employmentMode: 'Salaried',
    });
  }

  // Borrower B: SLIP_UPLOADED (profile + slip staged, no loan — drop-off)
  {
    const agent = request.agent(app);
    const ts = `b-${Date.now()}`;
    bEmail = `stage-b-${ts}@x.com`;
    await signupBorrower(agent, { email: bEmail });
    await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Slip User',
      pan: 'ABCDE1234F',
      dob: '1995-04-12',
      monthlySalary: 45000,
      employmentMode: 'Salaried',
    });
    const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({
      filename: 'slip.pdf',
      mime: 'application/pdf',
      size: 1000,
    });
    await agent.put('/api/v1/borrower/salary-slip').send({
      objectKey: pre.body.objectKey,
      filename: 'slip.pdf',
      mime: 'application/pdf',
      size: 1000,
    });
    // NOTE: does NOT apply for a loan — stays SLIP_UPLOADED
  }

  // Borrower C: APPLIED (has a loan)
  {
    const agent = request.agent(app);
    const ts = `c-${Date.now()}`;
    cEmail = `stage-c-${ts}@x.com`;
    await signupBorrower(agent, { email: cEmail });
    await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Applied User',
      pan: 'ABCDE1234F',
      dob: '1995-04-12',
      monthlySalary: 45000,
      employmentMode: 'Salaried',
    });
    const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({
      filename: 'slip.pdf',
      mime: 'application/pdf',
      size: 1000,
    });
    await agent.put('/api/v1/borrower/salary-slip').send({
      objectKey: pre.body.objectKey,
      filename: 'slip.pdf',
      mime: 'application/pdf',
      size: 1000,
    });
    const loanRes = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
    expect(loanRes.status).toBe(201);
  }
});

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('lead stage derivation', () => {
  it('derives correct stages for all borrower types', async () => {
    const admin = await adminAgent();
    const all = await admin.get('/api/v1/leads?limit=100');
    expect(all.status).toBe(200);

    const stages = Object.fromEntries(all.body.data.map((l: any) => [l.email, l.stage]));

    expect(stages[aEmail]).toBe('REGISTERED');
    expect(stages[dEmail]).toBe('DETAILS_SUBMITTED');
    expect(stages[bEmail]).toBe('SLIP_UPLOADED');
    expect(stages[cEmail]).toBe('APPLIED');
  });

  it('derives APPLIED stage once the borrower has a loan, and filters by stage', async () => {
    const admin = await adminAgent();
    const all = await admin.get('/api/v1/leads?limit=100');
    const stages = Object.fromEntries(all.body.data.map((l: any) => [l.email, l.stage]));
    expect(stages[cEmail]).toBe('APPLIED');
    expect(stages[bEmail]).toBe('SLIP_UPLOADED');
    const onlyApplied = await admin.get('/api/v1/leads?stage=APPLIED&limit=100');
    expect(onlyApplied.status).toBe(200);
    expect(onlyApplied.body.data.every((l: any) => l.stage === 'APPLIED')).toBe(true);
  });

  it('stage filter SLIP_UPLOADED returns only drop-off leads', async () => {
    const admin = await adminAgent();
    const res = await admin.get('/api/v1/leads?stage=SLIP_UPLOADED&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.every((l: any) => l.stage === 'SLIP_UPLOADED')).toBe(true);
    const emails = res.body.data.map((l: any) => l.email);
    expect(emails).toContain(bEmail);
    expect(emails).not.toContain(cEmail);
  });

  it('stage filter works for sales agent too', async () => {
    const sales = await salesAgent();
    const res = await sales.get('/api/v1/leads?stage=REGISTERED&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.every((l: any) => l.stage === 'REGISTERED')).toBe(true);
  });

  it('BRE_REJECTED stage is derived correctly', async () => {
    const admin = await adminAgent();
    const res = await admin.get('/api/v1/leads?limit=100');
    expect(res.status).toBe(200);
    const stages = Object.fromEntries(res.body.data.map((l: any) => [l.email, l.stage]));
    expect(stages[eEmail]).toBe('BRE_REJECTED');
  });

  it('pagination total reflects stage filter', async () => {
    const admin = await adminAgent();
    const allRes = await admin.get('/api/v1/leads?limit=100');
    const allApplied = allRes.body.data.filter((l: any) => l.stage === 'APPLIED').length;

    const filteredRes = await admin.get('/api/v1/leads?stage=APPLIED&limit=100');
    expect(filteredRes.body.pagination.total).toBe(allApplied);
  });
});
