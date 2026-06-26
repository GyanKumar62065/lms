import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Loan } from '../../src/models/loan.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('Loan product snapshot fields', () => {
  it('stores product ref + denormalized code/name', async () => {
    const productId = new mongoose.Types.ObjectId();
    const loan = await Loan.create({
      loanRef: 'LMS-2026-000999', borrower: new mongoose.Types.ObjectId(),
      principal: 20_000_000, tenureDays: 60, interestRate: 18, simpleInterest: 591781,
      totalRepayment: 20_591_781, amountPaid: 0, outstanding: 20_591_781, status: 'APPLIED',
      salarySlip: { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 },
      product: productId, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance',
      statusHistory: [{ from: null, to: 'APPLIED', at: new Date() }],
    });
    expect(loan.product?.toString()).toBe(productId.toString());
    expect(loan.productCode).toBe('SALARY_ADVANCE');
    expect(loan.productName).toBe('Salary Advance');
  });
  it('still allows a legacy loan with no product', async () => {
    const loan = await Loan.create({
      loanRef: 'LMS-2026-000998', borrower: new mongoose.Types.ObjectId(),
      principal: 20_000_000, tenureDays: 60, interestRate: 12, simpleInterest: 394521,
      totalRepayment: 20_394_521, amountPaid: 0, outstanding: 20_394_521, status: 'APPLIED',
      salarySlip: { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 },
      statusHistory: [{ from: null, to: 'APPLIED', at: new Date() }],
    });
    expect(loan.product).toBeUndefined();
  });
});
