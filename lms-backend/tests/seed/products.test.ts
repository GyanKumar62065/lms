import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runSeed } from '../../src/seed/seed';
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

describe('seed products', () => {
  it('inserts PERSONAL and SALARY_ADVANCE with paise bounds', async () => {
    await runSeed();
    const personal = await LoanProduct.findOne({ code: 'PERSONAL' });
    expect(personal).toBeTruthy();
    expect(personal!.interestRate).toBe(12);
    expect(personal!.minPrincipal).toBe(5_000_000); // ₹50,000
    expect(personal!.maxPrincipal).toBe(50_000_000); // ₹5,00,000
    expect(personal!.eligibility.minMonthlySalary).toBe(2_500_000); // ₹25,000
    const adv = await LoanProduct.findOne({ code: 'SALARY_ADVANCE' });
    expect(adv!.interestRate).toBe(18);
    expect(adv!.maxPrincipal).toBe(10_000_000); // ₹1,00,000
    expect(adv!.eligibility.employmentModes).toEqual(['Salaried']);
  });
  it('does not overwrite an edited product on re-seed', async () => {
    await LoanProduct.updateOne({ code: 'PERSONAL' }, { $set: { interestRate: 9 } });
    await runSeed();
    const personal = await LoanProduct.findOne({ code: 'PERSONAL' });
    expect(personal!.interestRate).toBe(9); // preserved, not reset to 12
  });
});
