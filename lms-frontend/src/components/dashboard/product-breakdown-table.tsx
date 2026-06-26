// src/components/dashboard/product-breakdown-table.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminMetrics } from '@/types/api';
import { formatRupeesAmount } from '@/lib/money';

function pct(v: number): string { return `${v.toFixed(1)}%`; }

export function ProductBreakdownTable({ rows }: { rows: AdminMetrics['byProduct'] }) {
  if (rows.length === 0) return <p className="text-muted-foreground">No product activity yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Applicants</TableHead>
          <TableHead>Borrowed</TableHead>
          <TableHead>Recovered</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Rejected</TableHead>
          <TableHead>Approval</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productCode}>
            <TableCell className="font-medium">{r.productName}</TableCell>
            <TableCell>{r.applicants}</TableCell>
            <TableCell>{formatRupeesAmount(r.borrowed)}</TableCell>
            <TableCell>{formatRupeesAmount(r.recovered)}</TableCell>
            <TableCell>{formatRupeesAmount(r.outstanding)}</TableCell>
            <TableCell>{r.active}</TableCell>
            <TableCell>{r.rejected}</TableCell>
            <TableCell>{pct(r.approvalRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
