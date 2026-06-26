// src/components/dashboard/__tests__/loan-workspace.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { loanDocument: vi.fn() } }));
import { LoanWorkspace } from '../loan-workspace';

const detail = {
  loan: { _id: 'L1', loanRef: 'LMS-2026-000001', status: 'APPLIED', principal: 200000,
    interestRate: 12, tenureDays: 60, totalRepayment: 20394521, amountPaid: 0, outstanding: 20394521,
    productName: 'Personal Loan', borrower: { _id: 'b', fullName: 'Rahul', email: 'r@x.com' }, statusHistory: [], createdAt: '2026-06-26' },
  payments: [],
  timeline: [{ type: 'STATUS', at: '2026-06-26T10:00:00Z', actor: { id: 'b', name: 'Rahul' }, detail: 'Created as APPLIED' }],
} as any;

describe('LoanWorkspace', () => {
  it('renders ref, borrower, document panel, timeline, and the action slot', () => {
    render(<LoanWorkspace detail={detail} action={<button>Approve</button>} />);
    expect(screen.getByText('LMS-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('Rahul')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view document/i })).toBeInTheDocument();
    expect(screen.getByText(/Created as APPLIED/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
  });
});
