import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LoanProduct } from '../../src/models/loan-product.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('LoanProduct model', () => {
  it('persists a product with defaults and an uppercase-indexed code', async () => {
    const p = await LoanProduct.create({
      code: 'PERSONAL',
      name: 'Personal Loan',
      description: 'A personal loan',
      interestRate: 12,
      minPrincipal: 5_000_000,
      maxPrincipal: 50_000_000,
      minTenureDays: 30,
      maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 2_500_000, employmentModes: ['Salaried'] },
    });
    expect(p.status).toBe('ACTIVE');
    expect(p.minPrincipal).toBe(5_000_000);
    expect(p.eligibility.employmentModes).toEqual(['Salaried']);
  });
  it('rejects a duplicate code', async () => {
    await LoanProduct.create({
      code: 'DUP', name: 'A', description: 'd', interestRate: 10,
      minPrincipal: 1000, maxPrincipal: 2000, minTenureDays: 7, maxTenureDays: 30,
      eligibility: { minAge: 21, maxAge: 60, minMonthlySalary: 1000, employmentModes: ['Salaried'] },
    });
    await expect(
      LoanProduct.create({
        code: 'DUP', name: 'B', description: 'd', interestRate: 10,
        minPrincipal: 1000, maxPrincipal: 2000, minTenureDays: 7, maxTenureDays: 30,
        eligibility: { minAge: 21, maxAge: 60, minMonthlySalary: 1000, employmentModes: ['Salaried'] },
      }),
    ).rejects.toThrow();
  });
});
