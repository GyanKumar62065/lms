// src/components/dashboard/__tests__/product-breakdown-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductBreakdownTable } from '../product-breakdown-table';

const rows = [{
  productCode: 'PERSONAL', productName: 'Personal Loan', applicants: 5, borrowed: 700000,
  recovered: 250000, outstanding: 450000, active: 3, rejected: 1, approvalRate: 80,
}];

describe('ProductBreakdownTable', () => {
  it('renders a row per product with money and rate formatting', () => {
    render(<ProductBreakdownTable rows={rows} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText('₹7,00,000')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });
  it('shows an empty state when there are no products', () => {
    render(<ProductBreakdownTable rows={[]} />);
    expect(screen.getByText(/no product activity/i)).toBeInTheDocument();
  });
});
