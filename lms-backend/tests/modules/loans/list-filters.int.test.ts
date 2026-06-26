import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { Loan } from '../../../src/models/loan.model';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

const slip = { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 };
let borrowerId: Types.ObjectId;

async function makeLoan(over: Record<string, unknown>) {
  const base = {
    loanRef: `T-${Math.random().toString(36).slice(2, 10)}`,
    borrower: borrowerId,
    principal: 20000000, tenureDays: 60, interestRate: 12,
    simpleInterest: 394521, totalRepayment: 20394521, amountPaid: 0, outstanding: 20394521,
    status: 'APPLIED', salarySlip: slip,
    productCode: 'PERSONAL', productName: 'Personal Loan',
    statusHistory: [{ from: null, to: 'APPLIED', by: borrowerId, at: new Date() }],
  };
  return Loan.create({ ...base, ...over });
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
  const b = await User.findOne({ email: 'borrower@lms.test' });
  borrowerId = b!._id as Types.ObjectId;
  // 5 loans: vary status, product, principal, createdAt
  await makeLoan({ loanRef: 'L-A', status: 'APPLIED', principal: 5000000, productCode: 'PERSONAL', createdAt: new Date('2026-01-10') });
  await makeLoan({ loanRef: 'L-B', status: 'DISBURSED', principal: 30000000, productCode: 'PERSONAL', createdAt: new Date('2026-03-10') });
  await makeLoan({ loanRef: 'L-C', status: 'REJECTED', principal: 8000000, productCode: 'SALARY_ADVANCE', createdAt: new Date('2026-05-10') });
  await makeLoan({ loanRef: 'L-D', status: 'CLOSED', principal: 12000000, productCode: 'SALARY_ADVANCE', createdAt: new Date('2026-06-01') });
  await makeLoan({ loanRef: 'L-E', status: 'DISBURSED', principal: 50000000, productCode: 'PERSONAL', createdAt: new Date('2026-06-20') });
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /loans filters', () => {
  it('filters by status', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?status=DISBURSED');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-B', 'L-E']);
  });
  it('filters by productCode', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?productCode=SALARY_ADVANCE');
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-C', 'L-D']);
  });
  it('filters by createdAt range', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?from=2026-05-01&to=2026-06-10');
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-C', 'L-D']);
  });
  it('to date is end-of-day inclusive (loan created at 14:00 on to-date is included)', async () => {
    // L-F is created at 2026-06-10T14:00:00Z — mid-afternoon on the boundary day
    await makeLoan({ loanRef: 'L-F', status: 'APPLIED', principal: 6000000, productCode: 'PERSONAL', createdAt: new Date('2026-06-10T14:00:00Z') });
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?to=2026-06-10');
    const refs = res.body.data.map((l: any) => l.loanRef);
    expect(refs).toContain('L-F');
  });
  it('filters by amount range (rupees on principal)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?minAmount=100000&maxAmount=350000');
    // principals in rupees: L-A 50k, L-B 300k, L-C 80k, L-D 120k, L-E 500k
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-B', 'L-D']);
  });
  it('searches by loanRef (q)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?q=L-C');
    expect(res.body.data.map((l: any) => l.loanRef)).toEqual(['L-C']);
  });
  it('searches by borrower email (q)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?q=borrower@lms.test&limit=100');
    // 5 base fixture loans + 1 added by 'to date is end-of-day inclusive' test
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });
  it('sorts by principal ascending', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?sort=principal&limit=100');
    const refs = res.body.data.map((l: any) => l.loanRef);
    expect(refs[0]).toBe('L-A'); // smallest principal
    expect(refs[refs.length - 1]).toBe('L-E'); // largest
  });
  it('paginates', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?limit=2&page=1');
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
  });
});
