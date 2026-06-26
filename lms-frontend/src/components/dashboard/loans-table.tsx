import * as React from 'react';
import Link from 'next/link';
import { Loan } from '@/types/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/common/status-badge';
import { formatRupees } from '@/lib/money';

export function LoansTable({
  loans,
  renderActions,
  linkBase,
}: {
  loans: Loan[];
  renderActions?: (loan: Loan) => React.ReactNode;
  linkBase?: string;
}) {
  if (loans.length === 0) {
    return <p className="text-muted-foreground">Nothing in this queue.</p>;
  }
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN') : '—');
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Loan Ref</TableHead>
          <TableHead>Borrower</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Principal</TableHead>
          <TableHead>Tenure</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Disbursed</TableHead>
          <TableHead>Status</TableHead>
          {renderActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => {
          const borrower = typeof loan.borrower === 'object' ? loan.borrower.fullName : '—';
          return (
            <TableRow key={loan._id}>
              <TableCell className="font-medium">
                {linkBase ? (
                  <Link className="underline" href={`${linkBase}/${loan._id}`}>
                    {loan.loanRef}
                  </Link>
                ) : (
                  loan.loanRef
                )}
              </TableCell>
              <TableCell>{borrower}</TableCell>
              <TableCell>{loan.productName ?? '—'}</TableCell>
              <TableCell>{formatRupees(loan.principal)}</TableCell>
              <TableCell>{loan.tenureDays}d</TableCell>
              <TableCell>{formatRupees(loan.outstanding)}</TableCell>
              <TableCell>{fmtDate(loan.disbursement?.at)}</TableCell>
              <TableCell>
                <StatusBadge status={loan.status} />
              </TableCell>
              {renderActions && <TableCell>{renderActions(loan)}</TableCell>}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
