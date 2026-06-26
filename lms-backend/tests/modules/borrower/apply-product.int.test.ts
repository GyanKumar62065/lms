import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';
import { applyLoan } from '../../helpers/apply-loan';
import { LoanProduct } from '../../../src/models/loan-product.model';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/u'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/d'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function readyBorrower(over: Record<string, unknown> = {}) {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'B', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried', ...over });
  await stageSlip(agent);
  return agent;
}
async function stageSlip(agent: any) {
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
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

describe('apply against a product', () => {
  it('404 when the product code is unknown/inactive', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'NOPE' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('422 PRODUCT_BOUNDS when principal is outside the product range', async () => {
    const agent = await readyBorrower();
    // SALARY_ADVANCE max is ₹1,00,000; ask for ₹2,00,000
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 200000, tenureDays: 30 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_BOUNDS');
    expect(res.body.error.details.maxPrincipal).toBe(100000); // rupees
  });

  it('422 PRODUCT_ELIGIBILITY_FAILED when profile fails the product rule', async () => {
    // Self-Employed passes PERSONAL but fails SALARY_ADVANCE (Salaried only)
    const agent = await readyBorrower({ employmentMode: 'Self-Employed' });
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_ELIGIBILITY_FAILED');
    expect(res.body.error.details.failedRules).toContain('EMPLOYMENT');
  });

  it('snapshots the product rate/code/name onto the loan', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(201);
    expect(res.body.productCode).toBe('SALARY_ADVANCE');
    expect(res.body.productName).toBe('Salary Advance');
    expect(res.body.interestRate).toBe(18);
    // 5,000,000 paise * 18 * 30 / (365*100) = 73,972.6 -> 73973
    expect(res.body.simpleInterest).toBe(73973);
  });

  it('allows one active loan PER product (different products OK)', async () => {
    const agent = await readyBorrower();
    const first = await applyLoan(agent, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    await stageSlip(agent);
    const second = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(second.status).toBe(201);
  });

  it('blocks a second active loan for the SAME product (409)', async () => {
    const agent = await readyBorrower();
    const first = await applyLoan(agent, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    await stageSlip(agent);
    const dup = await applyLoan(agent, { productCode: 'PERSONAL', principal: 100000, tenureDays: 90 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    expect(dup.body.error.details.productCode).toBe('PERSONAL');
  });

  it('snapshot is immutable: editing the product rate does not change an existing loan', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(201);
    await LoanProduct.updateOne({ code: 'SALARY_ADVANCE' }, { $set: { interestRate: 25 } });
    const after = await agent.get(`/api/v1/borrower/loans/${res.body._id}`);
    expect(after.body.loan.interestRate).toBe(18); // unchanged
  });
});
