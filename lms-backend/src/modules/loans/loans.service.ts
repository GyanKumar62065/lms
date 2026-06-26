import { Types } from 'mongoose';
import { Loan } from '../../models/loan.model';
import { User } from '../../models/user.model';
import { rupeesToPaise, paiseToRupees } from '../../lib/money';
import { NotFoundError } from '../../lib/errors';
import { nextStatus, LoanAction } from './state-machine';
import { Payment } from '../../models/payment.model';
import { getDownloadUrl } from '../../lib/storage';

type Actor = { id: string; name: string } | null;
type TimelineEntry = { type: 'STATUS' | 'SANCTION' | 'DISBURSEMENT' | 'PAYMENT'; at: Date; actor: Actor; detail: string };

type ListFilter = {
  status?: string;
  productCode?: string;
  from?: Date;
  to?: Date;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  sort: string;
  page: number;
  limit: number;
};

export async function listLoans(filter: ListFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.productCode) query.productCode = filter.productCode;
  if (filter.from || filter.to) {
    const createdAt: Record<string, Date> = {};
    if (filter.from) createdAt.$gte = filter.from;
    if (filter.to) {
      const toEndOfDay = new Date(filter.to);
      toEndOfDay.setUTCHours(23, 59, 59, 999);
      createdAt.$lte = toEndOfDay;
    }
    query.createdAt = createdAt;
  }
  if (filter.minAmount != null || filter.maxAmount != null) {
    const principal: Record<string, number> = {};
    if (filter.minAmount != null) principal.$gte = rupeesToPaise(filter.minAmount);
    if (filter.maxAmount != null) principal.$lte = rupeesToPaise(filter.maxAmount);
    query.principal = principal;
  }
  if (filter.q) {
    const rx = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchedUsers = await User.find({ $or: [{ fullName: rx }, { email: rx }] }, '_id');
    const ids = matchedUsers.map((u) => u._id as Types.ObjectId);
    query.$or = [{ loanRef: rx }, { borrower: { $in: ids } }];
  }
  const total = await Loan.countDocuments(query);
  const data = await Loan.find(query)
    .sort(filter.sort)
    .skip((filter.page - 1) * filter.limit)
    .limit(filter.limit)
    .populate('borrower', 'fullName email');
  return { data, pagination: { page: filter.page, limit: filter.limit, total } };
}

export async function getLoan(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Loan not found');
  const loan = await Loan.findById(id)
    .populate('borrower', 'fullName email')
    .populate('statusHistory.by', 'fullName')
    .populate('sanction.decidedBy', 'fullName')
    .populate('disbursement.by', 'fullName');
  if (!loan) throw new NotFoundError('Loan not found');

  const paymentDocs = await Payment.find({ loan: loan._id })
    .sort({ paidAt: 1 })
    .populate('recordedBy', 'fullName');

  const actorOf = (ref: any): Actor =>
    ref && ref._id ? { id: ref._id.toString(), name: ref.fullName } : null;

  const timeline: TimelineEntry[] = [];
  for (const h of loan.statusHistory as any[]) {
    timeline.push({
      type: 'STATUS',
      at: h.at,
      actor: actorOf(h.by),
      detail: h.from ? `${h.from} → ${h.to}${h.reason ? ` (${h.reason})` : ''}` : `Created as ${h.to}`,
    });
  }
  for (const p of paymentDocs) {
    timeline.push({
      type: 'PAYMENT',
      at: p.paidAt as Date,
      actor: actorOf((p as any).recordedBy),
      detail: `Payment ₹${paiseToRupees(p.amount as number).toLocaleString('en-IN')} (UTR ${p.utr})`,
    });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const payments = paymentDocs.map((p) => ({
    _id: p._id,
    utr: p.utr,
    amount: paiseToRupees(p.amount as number),
    paidAt: p.paidAt,
    recordedBy: actorOf((p as any).recordedBy),
  }));

  return { loan, payments, timeline };
}

async function transition(id: string, action: LoanAction, by: string, reason?: string) {
  const loan = await Loan.findById(id);
  if (!loan) throw new NotFoundError('Loan not found');
  const from = loan.status as any;            // capture BEFORE mutation
  const to = nextStatus(from, action);        // throws ConflictError if illegal
  loan.status = to;
  loan.statusHistory.push({ from, to, by: new Types.ObjectId(by), reason, at: new Date() } as any);
  if (action === 'SANCTION' || action === 'REJECT') loan.sanction = { decidedBy: new Types.ObjectId(by), reason, decidedAt: new Date() } as any;
  if (action === 'DISBURSE') loan.disbursement = { by: new Types.ObjectId(by), at: new Date() } as any;
  if (action === 'CANCEL') loan.cancellation = { by: new Types.ObjectId(by), reason, at: new Date() } as any;
  await loan.save();
  return loan;
}

export const sanction = (id: string, by: string) => transition(id, 'SANCTION', by);
export const reject = (id: string, by: string, reason: string) => transition(id, 'REJECT', by, reason);
export const disburse = (id: string, by: string) => transition(id, 'DISBURSE', by);
export const cancel = (id: string, by: string, reason?: string) => transition(id, 'CANCEL', by, reason);

export async function getLoanDocument(id: string) {
  const loan = await Loan.findById(id);
  if (!loan || !loan.salarySlip?.objectKey) throw new NotFoundError('Document not found');
  const url = await getDownloadUrl(loan.salarySlip.objectKey);
  return { url, filename: loan.salarySlip.filename, mime: loan.salarySlip.mime };
}
