import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CollectionsTable } from '../collections-table';
// totalRepayment in PAISE; payment.amount in RUPEES
const payments = [
  { _id: 'p1', utr: 'U1', amount: 1000, paidAt: '2026-06-20T00:00:00Z' },
  { _id: 'p2', utr: 'U2', amount: 1039.45, paidAt: '2026-06-25T00:00:00Z' },
] as any;
describe('CollectionsTable', () => {
  it('renders rows with running balance and SETTLED on the final clearing entry', () => {
    // total = ₹2,039.45 = 203945 paise; two payments clear it
    render(<CollectionsTable payments={payments} totalRepayment={203945} />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('U1')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/RECEIVED/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/SETTLED/)).toBeInTheDocument();
    // running balance after final entry is ₹0
    expect(within(rows[1]).getByText('₹0')).toBeInTheDocument();
  });

  it('decrements running balance by each payment', () => {
    // total = 300000 paise (₹3000); payments are different amounts to avoid collision
    // payment 1 = ₹500 → balance 250000 paise (₹2,500)
    // payment 2 = ₹750 → balance 175000 paise (₹1,750)
    // payment 3 = ₹1750 → balance 0 paise (₹0)
    const pmts = [
      { _id: 'p1', utr: 'U1', amount: 500, paidAt: '2026-06-01T00:00:00Z' },
      { _id: 'p2', utr: 'U2', amount: 750, paidAt: '2026-06-02T00:00:00Z' },
      { _id: 'p3', utr: 'U3', amount: 1750, paidAt: '2026-06-03T00:00:00Z' },
    ] as any;
    render(<CollectionsTable payments={pmts} totalRepayment={300000} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // After 1st payment: 300000 - 50000 = 250000 paise = ₹2,500
    expect(within(rows[0]).getByText('₹2,500')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/RECEIVED/)).toBeInTheDocument();
    // After 2nd payment: 250000 - 75000 = 175000 paise = ₹1,750
    expect(within(rows[1]).getByText('₹1,750')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/RECEIVED/)).toBeInTheDocument();
    // After 3rd payment: 175000 - 175000 = 0 paise = ₹0
    expect(within(rows[2]).getByText('₹0')).toBeInTheDocument();
    expect(within(rows[2]).getByText(/SETTLED/)).toBeInTheDocument();
  });

  it('renders payment amounts using formatRupeesAmount (rupees)', () => {
    const pmts = [
      { _id: 'p1', utr: 'U1', amount: 500, paidAt: '2026-06-01T00:00:00Z' },
    ] as any;
    render(<CollectionsTable payments={pmts} totalRepayment={50000} />);
    const rows = screen.getAllByRole('row').slice(1);
    // formatRupeesAmount(500) = ₹500
    expect(within(rows[0]).getByText('₹500')).toBeInTheDocument();
  });
});
