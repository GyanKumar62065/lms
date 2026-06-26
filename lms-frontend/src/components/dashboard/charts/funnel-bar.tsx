// src/components/dashboard/charts/funnel-bar.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function FunnelBar({ funnel }: { funnel: AdminMetrics['funnel'] }) {
  const data = [
    { stage: 'Applied', value: funnel.applied },
    { stage: 'Sanctioned', value: funnel.sanctioned },
    { stage: 'Disbursed', value: funnel.disbursed },
    { stage: 'Closed', value: funnel.closed },
    { stage: 'Rejected', value: funnel.rejected },
  ];
  return (
    <ChartContainer title="Application funnel" testId="chart-funnel">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="stage" width={80} />
          <Tooltip />
          <Bar dataKey="value" radius={4}>
            {data.map((d, i) => <Cell key={d.stage} fill={chartColor(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
