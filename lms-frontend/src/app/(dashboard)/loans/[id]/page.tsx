import { cookies } from 'next/headers';
import { endpoints } from '@/lib/api/endpoints';
import { requirePermission, getSession } from '@/lib/auth/session';
import { LoanWorkspace } from '@/components/dashboard/loan-workspace';
import { LoanActionPanel } from '@/components/dashboard/loan-action-panel';

export default async function OpsLoanDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('loan:read:all');
  const me = await getSession();
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const opts = { cookieHeader, serverBase: process.env.API_URL_INTERNAL };
  const detail = await endpoints.loanDetail(id, opts);
  return (
    <LoanWorkspace
      detail={detail}
      action={<LoanActionPanel loan={detail.loan} permissions={me!.permissions} />}
    />
  );
}
