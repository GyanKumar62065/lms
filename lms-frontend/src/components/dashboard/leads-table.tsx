import { Lead } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupees } from '@/lib/money';

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return <p className="text-muted-foreground">No leads in the funnel.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Stage</TableHead><TableHead>Salary</TableHead><TableHead>Employment</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((l) => (
          <TableRow key={l.userId}>
            <TableCell className="font-medium">{l.fullName}</TableCell>
            <TableCell>{l.email}</TableCell>
            <TableCell><Badge variant="secondary">{l.stage}</Badge></TableCell>
            <TableCell>{l.monthlySalary != null ? formatRupees(l.monthlySalary) : '—'}</TableCell>
            <TableCell>{l.employmentMode ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
