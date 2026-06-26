import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { Payment } from '../../src/models/payment.model';
import { nextSequence } from '../../src/models/counter.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  // ensure the unique index on utr is built before the duplicate-insert assertion
  await Payment.init();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('loan-domain models', () => {
  it('enforces unique UTR on payments', async () => {
    const loanId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await Payment.create({ loan: loanId, utr: 'UTR-1', amount: 1000, paidAt: new Date(), recordedBy: userId });
    await expect(
      Payment.create({ loan: loanId, utr: 'UTR-1', amount: 2000, paidAt: new Date(), recordedBy: userId }),
    ).rejects.toThrow();
  });
  it('increments a named counter', async () => {
    const a = await nextSequence('loanRef');
    const b = await nextSequence('loanRef');
    expect(b).toBe(a + 1);
  });
});
