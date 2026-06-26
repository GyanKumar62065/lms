// src/app/(dashboard)/admin/overview/__tests__/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

import { KpiCards } from '@/components/dashboard/kpi-cards';
import { FunnelBar } from '@/components/dashboard/charts/funnel-bar';
import { StatusDonut } from '@/components/dashboard/charts/status-donut';
import { RecoveryTimeSeries } from '@/components/dashboard/charts/recovery-timeseries';
import { ProductBars } from '@/components/dashboard/charts/product-bars';
import { ProductBreakdownTable } from '@/components/dashboard/product-breakdown-table';
import type { AdminMetrics } from '@/types/api';

const mockMetrics: AdminMetrics = {
  kpis: {
    totalDisbursed: 1_000_000,
    totalRecovered: 400_000,
    outstandingBook: 600_000,
    activeLoans: 5,
    totalApplications: 20,
    approvalRate: 75.0,
    rejectedCount: 3,
    rejectionRate: 15.0,
    avgTicketSize: 200_000,
  },
  byStatus: [
    { status: 'APPLIED', count: 6 },
    { status: 'SANCTIONED', count: 4 },
    { status: 'DISBURSED', count: 5 },
    { status: 'CLOSED', count: 3 },
    { status: 'REJECTED', count: 2 },
  ],
  funnel: { applied: 20, sanctioned: 12, disbursed: 9, closed: 3, rejected: 3 },
  timeSeries: [
    { month: '2026-04', disbursed: 500_000, recovered: 150_000 },
    { month: '2026-05', disbursed: 500_000, recovered: 250_000 },
  ],
  byProduct: [
    {
      productCode: 'PERSONAL',
      productName: 'Personal Loan',
      applicants: 12,
      borrowed: 600_000,
      recovered: 250_000,
      outstanding: 350_000,
      active: 4,
      rejected: 2,
      approvalRate: 83.3,
    },
  ],
};

describe('Admin Overview page composition', () => {
  it('renders KPI cards with mocked metrics', () => {
    render(<KpiCards kpis={mockMetrics.kpis} />);
    expect(screen.getByText('Total Disbursed')).toBeInTheDocument();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders FunnelBar chart container', () => {
    render(<FunnelBar funnel={mockMetrics.funnel} />);
    expect(screen.getByTestId('chart-funnel')).toBeInTheDocument();
  });

  it('renders StatusDonut chart container', () => {
    render(<StatusDonut data={mockMetrics.byStatus} />);
    expect(screen.getByTestId('chart-status-donut')).toBeInTheDocument();
  });

  it('renders RecoveryTimeSeries chart container', () => {
    render(<RecoveryTimeSeries data={mockMetrics.timeSeries} />);
    expect(screen.getByTestId('chart-timeseries')).toBeInTheDocument();
  });

  it('renders ProductBars chart container', () => {
    render(<ProductBars data={mockMetrics.byProduct} />);
    expect(screen.getByTestId('chart-product-bars')).toBeInTheDocument();
  });

  it('renders ProductBreakdownTable with product rows', () => {
    render(<ProductBreakdownTable rows={mockMetrics.byProduct} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
  });
});
