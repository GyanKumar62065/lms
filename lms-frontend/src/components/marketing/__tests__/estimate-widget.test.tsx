import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstimateWidget } from '../estimate-widget';
import { formatRupees } from '@/lib/money';
import type { PublicConfig, LoanProduct } from '@/types/api';

const config: PublicConfig = {
  loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: 12, minTenureDays: 30, maxTenureDays: 365 },
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
};

const products: LoanProduct[] = [
  { _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: config.eligibility, status: 'ACTIVE' },
  { _id: '2', code: 'SALARY_ADVANCE', name: 'Salary Advance', description: '', interestRate: 18, minPrincipal: 10000, maxPrincipal: 100000, minTenureDays: 7, maxTenureDays: 60, eligibility: config.eligibility, status: 'ACTIVE' },
];

describe('EstimateWidget', () => {
  it('renders a live total for defaults using config bounds (50000/30/12%)', () => {
    render(<EstimateWidget config={config} />);
    // initial state: amt=bounds.min=50000, ten=bounds.minT=30, rate=12
    const principalPaise = 5000000;
    const interestPaise = Math.round((principalPaise * 12 * 30) / (365 * 100));
    const totalPaise = principalPaise + interestPaise;
    expect(screen.getByTestId('estimate-total')).toHaveTextContent(formatRupees(totalPaise));
  });

  it('uses config interestRate=18 for the displayed total', () => {
    const cfg18: PublicConfig = { loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: 18, minTenureDays: 30, maxTenureDays: 365 }, eligibility: config.eligibility };
    render(<EstimateWidget config={cfg18} />);
    // initial state: amt=bounds.min=50000, ten=bounds.minT=30, rate=18
    const principalPaise = 5000000;
    const interestPaise = Math.round((principalPaise * 18 * 30) / (365 * 100));
    const totalPaise = principalPaise + interestPaise;
    expect(screen.getByTestId('estimate-total')).toHaveTextContent(formatRupees(totalPaise));
  });

  it('falls back to config rate when no products', () => {
    render(<EstimateWidget config={config} />);
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    expect(screen.getByTestId('estimate-total')).toBeInTheDocument();
  });

  it('shows a product selector when products are provided', () => {
    render(<EstimateWidget config={config} products={products} />);
    // The Select trigger is rendered as a combobox button; the dropdown is not open
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('switching product recomputes the estimate', async () => {
    // Two products with overlapping principal/tenure ranges but different rates.
    // The overlapping range (50000 principal, 30 days) is the initial state for PERSONAL.
    // After switching to SALARY_ADVANCE (rate 18 > 12), total repayment must increase.
    const switchProducts: LoanProduct[] = [
      {
        _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: '',
        interestRate: 12,
        minPrincipal: 50000, maxPrincipal: 500000,
        minTenureDays: 30, maxTenureDays: 365,
        eligibility: config.eligibility, status: 'ACTIVE',
      },
      {
        _id: '2', code: 'SALARY_ADVANCE', name: 'Salary Advance', description: '',
        interestRate: 18,
        minPrincipal: 50000, maxPrincipal: 100000,
        minTenureDays: 30, maxTenureDays: 60,
        eligibility: config.eligibility, status: 'ACTIVE',
      },
    ];

    const user = userEvent.setup();
    render(<EstimateWidget config={config} products={switchProducts} />);

    // Capture the initial estimate total (PERSONAL @ 12%)
    const initialTotal = screen.getByTestId('estimate-total').textContent ?? '';

    // Open the Select by clicking the combobox trigger
    await user.click(screen.getByRole('combobox'));

    // Pick "Salary Advance" from the open dropdown
    const option = await screen.findByRole('option', { name: /salary advance/i });
    await user.click(option);

    // After switching to SALARY_ADVANCE (rate 18%), the estimate total must be higher
    const updatedTotal = screen.getByTestId('estimate-total').textContent ?? '';
    expect(updatedTotal).not.toBe(initialTotal);

    // Verify the direction: higher rate means higher total repayment
    // Both totals are formatted rupee strings like "₹50,493"; strip non-digits to compare
    const strip = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10);
    expect(strip(updatedTotal)).toBeGreaterThan(strip(initialTotal));
  });
});
