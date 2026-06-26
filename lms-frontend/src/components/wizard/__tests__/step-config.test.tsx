import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push, refresh, apply, toastSuccess, toastError } = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), apply: vi.fn().mockResolvedValue({}), toastSuccess: vi.fn(), toastError: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { apply } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { StepConfig } from '../step-config';
import type { LoanProduct } from '@/types/api';

const product: LoanProduct = {
  _id: '1', code: 'SALARY_ADVANCE', name: 'Salary Advance', description: '',
  interestRate: 18, minPrincipal: 10000, maxPrincipal: 100000, minTenureDays: 7, maxTenureDays: 60,
  eligibility: { minAge: 21, maxAge: 55, minMonthlySalary: 15000, employmentModes: ['Salaried'] }, status: 'ACTIVE',
};
beforeEach(() => { push.mockClear(); apply.mockClear(); });

describe('StepConfig', () => {
  it('shows the product rate and submits productCode on apply', async () => {
    render(<StepConfig product={product} onApplied={() => {}} />);
    expect(screen.getByText(/18% p\.a\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /apply now/i }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ productCode: 'SALARY_ADVANCE' }));
    expect(push).toHaveBeenCalledWith('/my-loans');
  });
});
