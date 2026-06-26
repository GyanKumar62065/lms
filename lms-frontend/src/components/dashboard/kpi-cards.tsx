// src/components/dashboard/kpi-cards.tsx
import { Banknote, TrendingUp, Wallet, Activity, FileText, CheckCircle2, XCircle, Receipt, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminMetrics } from '@/types/api';
import { formatRupeesAmount } from '@/lib/money';

function pct(v: number): string { return `${v.toFixed(1)}%`; }

export function KpiCards({ kpis }: { kpis: AdminMetrics['kpis'] }) {
  const items: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Total Disbursed', value: formatRupeesAmount(kpis.totalDisbursed), Icon: Banknote },
    { label: 'Total Recovered', value: formatRupeesAmount(kpis.totalRecovered), Icon: TrendingUp },
    { label: 'Outstanding Book', value: formatRupeesAmount(kpis.outstandingBook), Icon: Wallet },
    { label: 'Active Loans', value: String(kpis.activeLoans), Icon: Activity },
    { label: 'Total Applications', value: String(kpis.totalApplications), Icon: FileText },
    { label: 'Approval Rate', value: pct(kpis.approvalRate), Icon: CheckCircle2 },
    { label: 'Rejected', value: `${kpis.rejectedCount} (${pct(kpis.rejectionRate)})`, Icon: XCircle },
    { label: 'Avg Ticket Size', value: formatRupeesAmount(kpis.avgTicketSize), Icon: Receipt },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, Icon }) => (
        <Card key={label} size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon size={16} />{label}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
        </Card>
      ))}
    </div>
  );
}
