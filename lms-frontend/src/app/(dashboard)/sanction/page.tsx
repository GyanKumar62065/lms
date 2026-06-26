import { cookies } from 'next/headers';
import { CheckCircle2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LoansTable } from '@/components/dashboard/loans-table';
import { LoanActionButtons } from '@/components/dashboard/loan-action-buttons';

export default async function SanctionPage() {
  await requirePermission('loan:sanction');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await endpoints.loans({ status: 'APPLIED' }, { cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><CheckCircle2 size={20} />Sanction — Applied Loans</h1>
      <div className="overflow-x-auto">
        <LoansTable
          loans={data}
          linkBase="/loans"
          renderActions={(loan) => <LoanActionButtons loanId={loan._id} mode="sanction" />}
        />
      </div>
    </div>
  );
}
