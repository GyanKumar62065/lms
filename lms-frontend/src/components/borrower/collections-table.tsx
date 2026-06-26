import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatRupees, formatRupeesAmount } from '@/lib/money';
import type { Payment } from '@/types/api';

export function CollectionsTable({ payments, totalRepayment }: { payments: Payment[]; totalRepayment: number }) {
  // totalRepayment is PAISE; payment.amount is RUPEES → convert to paise for running balance.
  let outstanding = totalRepayment;
  const rows = payments.map((p, i) => {
    outstanding -= Math.round(p.amount * 100);
    const status = outstanding <= 0 ? 'SETTLED' : 'RECEIVED';
    return { i: i + 1, p, balance: Math.max(0, outstanding), status };
  });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>S.No</TableHead>
          <TableHead>Date of Collection</TableHead>
          <TableHead>UTR</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Running balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.p._id}>
            <TableCell>{r.i}</TableCell>
            <TableCell>{new Date(r.p.paidAt).toLocaleDateString('en-IN')}</TableCell>
            <TableCell>{r.p.utr}</TableCell>
            <TableCell>{formatRupeesAmount(r.p.amount)}</TableCell>
            <TableCell>{r.status}</TableCell>
            <TableCell>{formatRupees(r.balance)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
