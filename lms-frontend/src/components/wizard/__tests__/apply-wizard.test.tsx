import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplyWizard } from '../apply-wizard';
import type { LoanProduct } from '@/types/api';

const products: LoanProduct[] = [
  { _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' },
];

describe('ApplyWizard', () => {
  it('shows a product picker when no product is selected', () => {
    render(<ApplyWizard products={products} />);
    expect(screen.getByText(/choose a loan product/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /personal loan/i })).toHaveAttribute('href', '/apply?product=PERSONAL');
  });
  it('starts the steps when a product is selected', () => {
    render(<ApplyWizard products={products} initialProduct={products[0]} />);
    expect(screen.queryByText(/choose a loan product/i)).not.toBeInTheDocument();
  });
});
