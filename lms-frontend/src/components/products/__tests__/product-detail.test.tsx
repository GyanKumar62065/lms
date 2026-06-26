import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { ProductDetail } from '../product-detail';
const product = { code: 'PERSONAL', name: 'Personal Loan', category: 'Personal', description: 'desc', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' } as any;
describe('ProductDetail', () => {
  it('shows the key facts and a live total', () => {
    render(<ProductDetail product={product} me={null} />);
    expect(screen.getByText(/Personal Loan/)).toBeInTheDocument();
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    expect(screen.getByTestId('detail-total')).toBeInTheDocument();
  });
  it('recomputes the total when tenure changes', async () => {
    render(<ProductDetail product={product} me={null} />);
    const before = screen.getByTestId('detail-total').textContent;
    const tenure = screen.getByTestId('tenure-slider').querySelector('input')!;
    try {
      await userEvent.clear(tenure); // base-ui slider exposes a hidden input
    } catch { /* hidden input is not editable — fall through to fireEvent */ }
    // fallback: fire change to max tenure
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(tenure, { target: { value: '365' } });
    expect(screen.getByTestId('detail-total').textContent).not.toBe(before);
  });
});
