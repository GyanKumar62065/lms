import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { Loan } from '../../../src/models/loan.model';
import { Payment } from '../../../src/models/payment.model';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryReplSet;
const app = createApp();
let borrowerId: Types.ObjectId;
let collectorId: Types.ObjectId;

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}
const slip = { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 };

async function makeLoan(over: Record<string, unknown>) {
  const base = {
    loanRef: `M-${Math.random().toString(36).slice(2, 10)}`,
    borrower: borrowerId, principal: 10000000, tenureDays: 60, interestRate: 12,
    simpleInterest: 0, totalRepayment: 10000000, amountPaid: 0, outstanding: 10000000,
    status: 'APPLIED', salarySlip: slip, productCode: 'PERSONAL', productName: 'Personal Loan',
    statusHistory: [{ from: null, to: 'APPLIED', by: borrowerId, at: new Date('2026-06-01') }],
  };
  return Loan.create({ ...base, ...over });
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
  borrowerId = (await User.findOne({ email: 'borrower@lms.test' }))!._id as Types.ObjectId;
  collectorId = (await User.findOne({ email: 'collection@lms.test' }))!._id as Types.ObjectId;

  // Fixture (principals in paise):
  // PERSONAL: 1 APPLIED(100k), 1 DISBURSED(200k, paid 50k, outstanding 150k), 1 CLOSED(300k, paid 300k)
  // SALARY_ADVANCE: 1 REJECTED(80k), 1 DISBURSED(120k, paid 0)
  await makeLoan({ status: 'APPLIED', principal: 10000000 });
  const d1 = await makeLoan({ status: 'DISBURSED', principal: 20000000, amountPaid: 5000000, outstanding: 15000000, disbursement: { by: borrowerId, at: new Date('2026-06-05') } });
  await makeLoan({ status: 'CLOSED', principal: 30000000, amountPaid: 30000000, outstanding: 0, disbursement: { by: borrowerId, at: new Date('2026-06-10') } });
  await makeLoan({ status: 'REJECTED', principal: 8000000, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance' });
  const d2 = await makeLoan({ status: 'DISBURSED', principal: 12000000, amountPaid: 0, outstanding: 12000000, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance', disbursement: { by: borrowerId, at: new Date('2026-06-15') } });

  await Payment.create([
    { loan: d1._id, utr: 'P1', amount: 5000000, paidAt: new Date('2026-06-20'), recordedBy: collectorId },
    { loan: (await Loan.findOne({ status: 'CLOSED' }))!._id, utr: 'P2', amount: 30000000, paidAt: new Date('2026-06-22'), recordedBy: collectorId },
  ]);
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /admin/metrics', () => {
  it('403s a role without metrics:read', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales.get('/api/v1/admin/metrics');
    expect(res.status).toBe(403);
  });

  it('returns correct KPIs, funnel, byStatus, byProduct', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/admin/metrics');
    expect(res.status).toBe(200);
    const { kpis, byStatus, funnel, byProduct } = res.body;

    // totalDisbursed = 200k + 300k + 120k = 620,000 rupees
    expect(kpis.totalDisbursed).toBe(620000);
    // totalRecovered = 50k + 300k = 350,000
    expect(kpis.totalRecovered).toBe(350000);
    // outstandingBook (DISBURSED only) = 150k + 120k = 270,000
    expect(kpis.outstandingBook).toBe(270000);
    expect(kpis.activeLoans).toBe(2);
    expect(kpis.totalApplications).toBe(5);
    // decided = 5 - 1 applied = 4; approved (SANCTIONED+DISBURSED+CLOSED) = 3 → 75.0
    expect(kpis.approvalRate).toBe(75);
    expect(kpis.rejectedCount).toBe(1);
    expect(kpis.rejectionRate).toBe(25);
    // avgTicketSize over disbursed/closed (200k,300k,120k) = 620000/3 = 206666.67 → round
    expect(kpis.avgTicketSize).toBe(206667);

    const statusMap = Object.fromEntries(byStatus.map((s: any) => [s.status, s.count]));
    expect(statusMap).toMatchObject({ APPLIED: 1, DISBURSED: 2, CLOSED: 1, REJECTED: 1 });

    expect(funnel).toEqual({ applied: 5, sanctioned: 3, disbursed: 3, closed: 1, rejected: 1 });

    const personal = byProduct.find((p: any) => p.productCode === 'PERSONAL');
    expect(personal).toMatchObject({ applicants: 3, borrowed: 500000, recovered: 350000, outstanding: 150000, active: 1, rejected: 0 });
    const sa = byProduct.find((p: any) => p.productCode === 'SALARY_ADVANCE');
    expect(sa).toMatchObject({ applicants: 2, borrowed: 120000, recovered: 0, outstanding: 120000, active: 1, rejected: 1 });
  });

  it('returns a 12-month time series including June 2026 disbursed and recovered', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/admin/metrics');
    const ts = res.body.timeSeries;
    expect(ts).toHaveLength(12);
    expect(ts.every((m: any) => /^\d{4}-\d{2}$/.test(m.month))).toBe(true);
    const june = ts.find((m: any) => m.month === '2026-06');
    expect(june).toBeTruthy();
    // disbursed in June (by disbursement.at): 200k + 300k + 120k = 620,000
    expect(june.disbursed).toBe(620000);
    // recovered in June (by paidAt): 50k + 300k = 350,000
    expect(june.recovered).toBe(350000);
  });
});
