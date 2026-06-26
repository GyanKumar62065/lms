// src/components/dashboard/__tests__/kpi-cards.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCards } from '../kpi-cards';

const kpis = {
  totalDisbursed: 700000, totalRecovered: 250000, outstandingBook: 450000,
  activeLoans: 3, totalApplications: 10, approvalRate: 60,
  rejectedCount: 2, rejectionRate: 20, avgTicketSize: 233333,
};

describe('KpiCards', () => {
  it('renders money KPIs in rupees and rates as percentages', () => {
    render(<KpiCards kpis={kpis} />);
    expect(screen.getByText('Total Disbursed')).toBeInTheDocument();
    expect(screen.getByText('₹7,00,000')).toBeInTheDocument();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Approval Rate')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });
});
