// src/app/(dashboard)/admin/overview/page.tsx
import { cookies } from 'next/headers';
import { LayoutDashboard } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { StatusDonut } from '@/components/dashboard/charts/status-donut';
import { FunnelBar } from '@/components/dashboard/charts/funnel-bar';
import { RecoveryTimeSeries } from '@/components/dashboard/charts/recovery-timeseries';
import { ProductBars } from '@/components/dashboard/charts/product-bars';
import { ProductBreakdownTable } from '@/components/dashboard/product-breakdown-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OverviewPage() {
  await requirePermission('metrics:read');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const m = await endpoints.adminMetrics({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><LayoutDashboard size={20} />Portfolio Overview</h1>
      <KpiCards kpis={m.kpis} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelBar funnel={m.funnel} />
        <StatusDonut data={m.byStatus} />
        <RecoveryTimeSeries data={m.timeSeries} />
        <ProductBars data={m.byProduct} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Per-product performance</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto"><ProductBreakdownTable rows={m.byProduct} /></CardContent>
      </Card>
    </div>
  );
}
