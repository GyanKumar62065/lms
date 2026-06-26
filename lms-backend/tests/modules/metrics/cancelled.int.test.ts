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
let borrowerId: Types.ObjectId;

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

const slip = { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 };

async function makeLoan(over: Record<string, unknown>) {
  const base = {
    loanRef: `C-${Math.random().toString(36).slice(2, 10)}`,
    borrower: borrowerId,
    principal: 10000000,
    tenureDays: 60,
    interestRate: 12,
    simpleInterest: 0,
    totalRepayment: 10000000,
    amountPaid: 0,
    outstanding: 10000000,
    status: 'APPLIED',
    salarySlip: slip,
    productCode: 'PERSONAL',
    productName: 'Personal Loan',
    statusHistory: [{ from: null, to: 'APPLIED', by: borrowerId, at: new Date('2026-06-01') }],
  };
  return Loan.create({ ...base, ...over });
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
  borrowerId = (await User.findOne({ email: 'borrower@lms.test' }))!._id as Types.ObjectId;

  // Fixture:
  // 3 decided (SANCTIONED, DISBURSED, CLOSED) → all approved
  // 0 rejected
  // 1 CANCELLED  → must NOT count in decided
  // 2 APPLIED    → not yet decided
  // Total = 6; decided = 3; cancelled = 1; applied = 2
  await makeLoan({ status: 'SANCTIONED' });
  await makeLoan({ status: 'DISBURSED', amountPaid: 0, outstanding: 10000000, disbursement: { by: borrowerId, at: new Date('2026-06-05') } });
  await makeLoan({ status: 'CLOSED', principal: 10000000, amountPaid: 10000000, outstanding: 0, disbursement: { by: borrowerId, at: new Date('2026-06-10') } });
  await makeLoan({ status: 'CANCELLED' });
  await makeLoan({ status: 'APPLIED' });
  await makeLoan({ status: 'APPLIED' });
});

afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('GET /admin/metrics — CANCELLED handling', () => {
  it('excludes CANCELLED from the approvalRate denominator and lists it in byStatus', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/admin/metrics');
    expect(res.status).toBe(200);
    const { kpis, byStatus } = res.body;

    // decided = totalApplications(6) - appliedCount(2) - cancelledCount(1) = 3
    // approvedCount (SANCTIONED+DISBURSED+CLOSED) = 3
    // approvalRate = 3/3 = 100%
    expect(kpis.approvalRate).toBe(100);

    // rejectedCount = 0, rejectionRate = 0/3 = 0%
    expect(kpis.rejectedCount).toBe(0);
    expect(kpis.rejectionRate).toBe(0);

    // totalApplications includes CANCELLED
    expect(kpis.totalApplications).toBe(6);

    // activeLoans = DISBURSED only (not CANCELLED)
    expect(kpis.activeLoans).toBe(1);

    // byStatus must include a CANCELLED entry
    const cancelledEntry = byStatus.find((s: any) => s.status === 'CANCELLED');
    expect(cancelledEntry).toBeDefined();
    expect(cancelledEntry?.count).toBe(1);
  });
});
