import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { FileText } from 'lucide-react';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { MoneyText } from '@/components/common/money-text';
import { StatusBadge } from '@/components/common/status-badge';
import { LoanTimeline } from '@/components/common/loan-timeline';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { CancelLoanButton } from '@/components/borrower/cancel-loan-button';

export default async function MyLoansPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  let data;
  try {
    const res = await endpoints.myLoans({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
    data = res.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect('/login');
    return (
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><FileText size={20} />My Applications</h1>
        <p className="text-muted-foreground">Couldn&apos;t load your applications right now. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><FileText size={20} />My Applications</h1>
        <Link href="/apply" className={buttonVariants()}>+ New application</Link>
      </div>
      {data.length === 0 && <p className="text-muted-foreground">No applications yet.</p>}
      {data.map((loan) => (
        <Card key={loan._id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <Link href={`/my-loans/${loan._id}`} className="font-medium hover:underline">{loan.loanRef}</Link>
              <p className="text-sm text-muted-foreground"><MoneyText paise={loan.principal} /> · {loan.tenureDays}d</p>
            </div>
            <StatusBadge status={loan.status} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <LoanTimeline status={loan.status} />
            {loan.status === 'REJECTED' && loan.sanction?.reason && (
              <p className="text-red-700">Reason: {loan.sanction.reason}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={<MoneyText paise={loan.totalRepayment} />} />
              <Stat label="Paid" value={<MoneyText paise={loan.amountPaid} />} />
              <Stat label="Outstanding" value={<MoneyText paise={loan.outstanding} />} />
            </div>
          </CardContent>
          <CardFooter>
            <CancelLoanButton loanId={loan._id} status={loan.status} />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
