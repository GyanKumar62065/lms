import mongoose, { Types } from 'mongoose';
import { Loan } from '../../models/loan.model';
import { Payment } from '../../models/payment.model';
import { rupeesToPaise } from '../../lib/money';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { nextStatus } from '../loans/state-machine';

export async function listPayments(loanId: string) {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new NotFoundError('Loan not found');
  const payments = await Payment.find({ loan: loan._id }).sort({ paidAt: 1 });
  return { data: payments, outstanding: loan.outstanding, totalRepayment: loan.totalRepayment };
}

export async function recordPayment(
  loanId: string,
  by: string,
  input: { utr: string; amount: number; paidAt: Date },
) {
  const amountPaise = rupeesToPaise(input.amount);
  if (amountPaise <= 0) throw new ValidationError('Amount must be positive');

  const session = await mongoose.startSession();
  try {
    let result!: { loan: any; payment: any };
    await session.withTransaction(async () => {
      const loan = await Loan.findById(loanId).session(session);
      if (!loan) throw new NotFoundError('Loan not found');
      if (loan.status !== 'DISBURSED') throw new ConflictError('Loan is not open for collection');
      if (amountPaise > loan.outstanding) throw new ValidationError('Amount exceeds outstanding balance');

      const disbursedAt = (loan.disbursement as any)?.at as Date;
      if (disbursedAt && input.paidAt < disbursedAt) {
        throw new ValidationError('Payment date cannot be before disbursement');
      }

      const dup = await Payment.findOne({ utr: input.utr }).session(session);
      if (dup) throw new ConflictError('Duplicate UTR');

      const [payment] = await Payment.create(
        [{ loan: loan._id, utr: input.utr, amount: amountPaise, paidAt: input.paidAt, recordedBy: new Types.ObjectId(by) }],
        { session },
      );

      loan.amountPaid += amountPaise;
      loan.outstanding = loan.totalRepayment - loan.amountPaid;
      if (loan.outstanding === 0) {
        const from = loan.status as any;
        loan.status = nextStatus(from, 'CLOSE');
        loan.statusHistory.push({ from, to: 'CLOSED', by: new Types.ObjectId(by), reason: 'Fully repaid', at: new Date() } as any);
      }
      await loan.save({ session });
      result = { loan, payment };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
