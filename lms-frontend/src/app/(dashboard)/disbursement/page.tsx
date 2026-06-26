import { cookies } from 'next/headers';
import { Banknote } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LoansTable } from '@/components/dashboard/loans-table';
import { LoanActionButtons } from '@/components/dashboard/loan-action-buttons';

export default async function DisbursementPage() {
  await requirePermission('loan:disburse');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await endpoints.loans({ status: 'SANCTIONED' }, { cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><Banknote size={20} />Disbursement — Sanctioned Loans</h1>
      <div className="overflow-x-auto">
        <LoansTable
          loans={data}
          linkBase="/loans"
          renderActions={(loan) => <LoanActionButtons loanId={loan._id} mode="disburse" />}
        />
      </div>
    </div>
  );
}
