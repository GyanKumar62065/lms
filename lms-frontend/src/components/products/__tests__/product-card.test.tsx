import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '../product-card';
import type { LoanProduct } from '@/types/api';

const product: LoanProduct = {
  _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: 'Flexible cash',
  interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
  status: 'ACTIVE',
};

describe('ProductCard', () => {
  it('shows name, rate, ranges and links Apply to /apply?product=<code>', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    const apply = screen.getByRole('link', { name: /apply/i });
    expect(apply).toHaveAttribute('href', '/apply?product=PERSONAL');
  });

  it('links the card body to the product detail page', () => {
    render(<ProductCard product={{ code: 'PERSONAL', name: 'Personal Loan', description: 'd', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' } as any} />);
    const detail = screen.getByRole('link', { name: /view details/i });
    expect(detail).toHaveAttribute('href', '/products/PERSONAL');
  });
});
