// src/components/dashboard/__tests__/loans-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoansTable } from '../loans-table';

const loans = [{
  _id: 'L1', loanRef: 'LMS-2026-000001', borrower: { _id: 'u1', fullName: 'Rahul Kumar', email: 'r@x.com' },
  principal: 200000, tenureDays: 60, interestRate: 12, simpleInterest: 3945, totalRepayment: 203945,
  amountPaid: 0, outstanding: 203945, status: 'DISBURSED', productName: 'Personal Loan',
  disbursement: { at: '2026-06-20T00:00:00.000Z' }, statusHistory: [], createdAt: '2026-06-19T00:00:00.000Z',
}] as any;

describe('LoansTable', () => {
  it('renders product, outstanding and disbursed columns', () => {
    render(<LoansTable loans={loans} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText('₹2,039.45')).toBeInTheDocument(); // outstanding (paise → formatRupees: 203945 paise = ₹2,039.45)
    expect(screen.getByText('Product')).toBeInTheDocument();
  });
  it('links the loan ref when linkBase is set', () => {
    render(<LoansTable loans={loans} linkBase="/admin/loans" />);
    const link = screen.getByRole('link', { name: 'LMS-2026-000001' });
    expect(link).toHaveAttribute('href', '/admin/loans/L1');
  });
});
