import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/status-badge';
import { LoanTimeline } from '@/components/common/loan-timeline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupees, formatRupeesAmount } from '@/lib/money';
import { buttonVariants } from '@/components/ui/button';

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('loan:read:all');
  const { id } = await params;
  const cookieStore = await cookies();
  const { loan, payments, timeline } = await endpoints.loanDetail(id, { cookieHeader: cookieStore.toString(), serverBase: process.env.API_URL_INTERNAL });
  const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN');

  return (
    <div className="space-y-6">
      <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="/admin/loans"><ArrowLeft size={16} />Back to loans</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{loan.loanRef}</h1>
        <StatusBadge status={loan.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Borrower</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{borrower?.fullName ?? '—'}</p>
            <p className="text-muted-foreground">{borrower?.email ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Product</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{loan.productName ?? '—'}</p>
            <p className="text-muted-foreground">{loan.productCode ?? '—'} · {loan.interestRate}% p.a.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Principal: {formatRupees(loan.principal)}</p>
            <p>Total repayment: {formatRupees(loan.totalRepayment)}</p>
            <p>Outstanding: {formatRupees(loan.outstanding)}</p>
            <p>Tenure: {loan.tenureDays} days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {payments.length === 0 ? (
            <p className="text-muted-foreground">No payments recorded.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>UTR</TableHead><TableHead>Amount</TableHead><TableHead>Paid at</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.utr}</TableCell>
                    <TableCell>{formatRupeesAmount(p.amount)}</TableCell>
                    <TableCell>{fmtDate(p.paidAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
        <CardContent><LoanTimeline status={loan.status} entries={timeline} /></CardContent>
      </Card>
    </div>
  );
}
