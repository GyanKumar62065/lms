// src/components/dashboard/charts/status-donut.tsx
'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function StatusDonut({ data }: { data: AdminMetrics['byStatus'] }) {
  return (
    <ChartContainer title="Loans by status" testId="chart-status-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {data.map((d, i) => <Cell key={d.status} fill={chartColor(i)} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
