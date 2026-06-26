// src/components/dashboard/loan-workspace.tsx
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/common/status-badge';
import { LoanTimeline } from '@/components/common/loan-timeline';
import { DocumentPanel } from './document-panel';
import { formatRupees, formatRupeesAmount } from '@/lib/money';
import type { LoanDetail } from '@/types/api';

export function LoanWorkspace({ detail, action }: { detail: LoanDetail; action?: ReactNode }) {
  const { loan, payments, timeline } = detail;
  const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{loan.loanRef}</h1>
        <StatusBadge status={loan.status} />
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Borrower</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div>{borrower?.fullName ?? '—'}</div>
            <div className="text-muted-foreground">{borrower?.email}</div>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Product &amp; terms</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>{loan.productName ?? '—'}</div>
            <div>Principal: {formatRupees(loan.principal)}</div>
            <div>Rate: {loan.interestRate}% · {loan.tenureDays} days</div>
            <div>Total: {formatRupees(loan.totalRepayment)}</div>
            <div>Outstanding: {formatRupees(loan.outstanding)}</div>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Document</CardTitle></CardHeader>
          <CardContent><DocumentPanel loanId={loan._id} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Collections</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-sm text-muted-foreground">No collections yet.</p> : (
            <Table><TableHeader><TableRow><TableHead>S.No</TableHead><TableHead>UTR</TableHead><TableHead>Amount</TableHead><TableHead>Paid at</TableHead></TableRow></TableHeader>
              <TableBody>{payments.map((p, i) => (
                <TableRow key={p._id}><TableCell>{i + 1}</TableCell><TableCell>{p.utr}</TableCell><TableCell>{formatRupeesAmount(p.amount)}</TableCell><TableCell>{new Date(p.paidAt).toLocaleDateString('en-IN')}</TableCell></TableRow>
              ))}</TableBody></Table>
          )}
        </CardContent></Card>
      <Card><CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
        <CardContent><LoanTimeline status={loan.status} entries={timeline} /></CardContent></Card>
    </div>
  );
}
