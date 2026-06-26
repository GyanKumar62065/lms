import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { StatusBadge } from '@/components/common/status-badge';
import { CollectionsTable } from '@/components/borrower/collections-table';
import { DocumentLink } from '@/components/borrower/document-link';
import { CancelLoanButton } from '@/components/borrower/cancel-loan-button';
import { formatRupees } from '@/lib/money';

export default async function MyLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  let detail;
  try {
    detail = await endpoints.myLoanDetail(id, { cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  } catch {
    notFound();
  }
  const { loan, payments } = detail!;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{loan.loanRef}</h1>
        <StatusBadge status={loan.status} />
        <CancelLoanButton loanId={loan._id} status={loan.status} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>Total: {formatRupees(loan.totalRepayment)}</div>
        <div>Paid: {formatRupees(loan.amountPaid)}</div>
        <div>Outstanding: {formatRupees(loan.outstanding)}</div>
      </div>
      <DocumentLink loanId={loan._id} />
      {(loan.status === 'DISBURSED' || loan.status === 'CLOSED') && (
        <section className="space-y-2">
          <h2 className="font-semibold">Collections</h2>
          <CollectionsTable payments={payments} totalRepayment={loan.totalRepayment} />
        </section>
      )}
    </div>
  );
}
