// src/components/dashboard/charts/product-bars.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function ProductBars({ data }: { data: AdminMetrics['byProduct'] }) {
  return (
    <ChartContainer title="Per-product: borrowed vs recovered" testId="chart-product-bars">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="productName" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="borrowed" name="Borrowed" fill={chartColor(0)} radius={4} />
          <Bar dataKey="recovered" name="Recovered" fill={chartColor(1)} radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
