import { Loan } from '../../models/loan.model';
import { Payment } from '../../models/payment.model';
import { paiseToRupees } from '../../lib/money';

const DISBURSED_OR_CLOSED = ['DISBURSED', 'CLOSED'];
const APPROVED = ['SANCTIONED', 'DISBURSED', 'CLOSED'];

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal place
}

function lastTwelveMonths(now: Date): string[] {
  const months: string[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export async function getMetrics() {
  const [facet] = await Loan.aggregate([
    {
      $facet: {
        kpis: [
          {
            $group: {
              _id: null,
              totalDisbursed: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              totalRecovered: { $sum: '$amountPaid' },
              outstandingBook: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, '$outstanding', 0] } },
              activeLoans: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, 1, 0] } },
              totalApplications: { $sum: 1 },
              approvedCount: { $sum: { $cond: [{ $in: ['$status', APPROVED] }, 1, 0] } },
              rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
              appliedCount: { $sum: { $cond: [{ $eq: ['$status', 'APPLIED'] }, 1, 0] } },
              cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
              disbursedSum: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              disbursedCount: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, 1, 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byProduct: [
          {
            $group: {
              _id: { code: '$productCode', name: '$productName' },
              applicants: { $sum: 1 },
              borrowed: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              recovered: { $sum: '$amountPaid' },
              outstanding: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, '$outstanding', 0] } },
              active: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
              approved: { $sum: { $cond: [{ $in: ['$status', APPROVED] }, 1, 0] } },
              applied: { $sum: { $cond: [{ $eq: ['$status', 'APPLIED'] }, 1, 0] } },
            },
          },
        ],
        disbursedByMonth: [
          { $match: { 'disbursement.at': { $ne: null } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$disbursement.at' } },
              disbursed: { $sum: '$principal' },
            },
          },
        ],
      },
    },
  ]);

  const recoveredByMonth = await Payment.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, recovered: { $sum: '$amount' } } },
  ]);

  const k = facet.kpis[0] ?? {
    totalDisbursed: 0, totalRecovered: 0, outstandingBook: 0, activeLoans: 0,
    totalApplications: 0, approvedCount: 0, rejectedCount: 0, appliedCount: 0, cancelledCount: 0, disbursedSum: 0, disbursedCount: 0,
  };
  const decided = k.totalApplications - k.appliedCount - k.cancelledCount;

  const kpis = {
    totalDisbursed: paiseToRupees(k.totalDisbursed),
    totalRecovered: paiseToRupees(k.totalRecovered),
    outstandingBook: paiseToRupees(k.outstandingBook),
    activeLoans: k.activeLoans,
    totalApplications: k.totalApplications,
    approvalRate: pct(k.approvedCount, decided),
    rejectedCount: k.rejectedCount,
    rejectionRate: pct(k.rejectedCount, decided),
    avgTicketSize: k.disbursedCount === 0 ? 0 : Math.round(paiseToRupees(k.disbursedSum) / k.disbursedCount),
  };

  const byStatus = facet.byStatus.map((s: any) => ({ status: s._id, count: s.count }));
  const statusCount = (st: string) => facet.byStatus.find((s: any) => s._id === st)?.count ?? 0;
  const funnel = {
    applied: k.totalApplications,
    sanctioned: statusCount('SANCTIONED') + statusCount('DISBURSED') + statusCount('CLOSED'),
    disbursed: statusCount('DISBURSED') + statusCount('CLOSED'),
    closed: statusCount('CLOSED'),
    rejected: statusCount('REJECTED'),
  };

  const byProduct = facet.byProduct
    .filter((p: any) => p._id.code) // ignore legacy loans with no product
    .map((p: any) => {
      const productDecided = p.applicants - p.applied;
      return {
        productCode: p._id.code,
        productName: p._id.name,
        applicants: p.applicants,
        borrowed: paiseToRupees(p.borrowed),
        recovered: paiseToRupees(p.recovered),
        outstanding: paiseToRupees(p.outstanding),
        active: p.active,
        rejected: p.rejected,
        approvalRate: pct(p.approved, productDecided),
      };
    })
    .sort((a: any, b: any) => a.productName.localeCompare(b.productName));

  const disbursedMap = new Map<string, number>(facet.disbursedByMonth.map((m: any) => [m._id, m.disbursed]));
  const recoveredMap = new Map<string, number>(recoveredByMonth.map((m: any) => [m._id, m.recovered]));
  const timeSeries = lastTwelveMonths(new Date()).map((month) => ({
    month,
    disbursed: paiseToRupees(disbursedMap.get(month) ?? 0),
    recovered: paiseToRupees(recoveredMap.get(month) ?? 0),
  }));

  return { kpis, byStatus, funnel, timeSeries, byProduct };
}
