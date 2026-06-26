// src/components/dashboard/charts/__tests__/charts.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 800, height: 300 }}>{children}</div>
  ) };
});

import { StatusDonut } from '../status-donut';
import { FunnelBar } from '../funnel-bar';
import { RecoveryTimeSeries } from '../recovery-timeseries';
import { ProductBars } from '../product-bars';

describe('dashboard charts mount', () => {
  it('StatusDonut renders its container', () => {
    render(<StatusDonut data={[{ status: 'APPLIED', count: 4 }, { status: 'CLOSED', count: 1 }] as any} />);
    expect(screen.getByTestId('chart-status-donut')).toBeInTheDocument();
  });
  it('FunnelBar renders its container', () => {
    render(<FunnelBar funnel={{ applied: 10, sanctioned: 6, disbursed: 4, closed: 1, rejected: 2 }} />);
    expect(screen.getByTestId('chart-funnel')).toBeInTheDocument();
  });
  it('RecoveryTimeSeries renders its container', () => {
    render(<RecoveryTimeSeries data={[{ month: '2026-05', disbursed: 100, recovered: 40 }]} />);
    expect(screen.getByTestId('chart-timeseries')).toBeInTheDocument();
  });
  it('ProductBars renders its container', () => {
    render(<ProductBars data={[{ productCode: 'PERSONAL', productName: 'Personal', borrowed: 500, recovered: 200 } as any]} />);
    expect(screen.getByTestId('chart-product-bars')).toBeInTheDocument();
  });
});
