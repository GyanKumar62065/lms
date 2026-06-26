// src/components/dashboard/__tests__/products-table.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { deactivateProduct, activateProduct, refresh } = vi.hoisted(() => ({
  deactivateProduct: vi.fn().mockResolvedValue({}), activateProduct: vi.fn().mockResolvedValue({}), refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { deactivateProduct, activateProduct, createProduct: vi.fn(), updateProduct: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { ProductsTable } from '../products-table';
import type { LoanProduct } from '@/types/api';

const products: LoanProduct[] = [
  { _id: 'a', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' },
];
beforeEach(() => deactivateProduct.mockClear());

describe('ProductsTable', () => {
  it('lists products and deactivates an active one', async () => {
    render(<ProductsTable products={products} />);
    expect(screen.getByText('PERSONAL')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    expect(deactivateProduct).toHaveBeenCalledWith('a');
  });
});
