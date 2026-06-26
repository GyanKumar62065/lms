// src/components/dashboard/__tests__/product-form-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createProduct, refresh, toastSuccess } = vi.hoisted(() => ({
  createProduct: vi.fn().mockResolvedValue({}), refresh: vi.fn(), toastSuccess: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { createProduct, updateProduct: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { ProductFormDialog } from '../product-form-dialog';
import { Button } from '@/components/ui/button';

beforeEach(() => createProduct.mockClear());

describe('ProductFormDialog (create)', () => {
  it('submits a new product with rupee bounds', async () => {
    render(<ProductFormDialog trigger={<Button>New</Button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.type(screen.getByLabelText(/code/i), 'GOLD');
    await userEvent.type(screen.getByLabelText(/^name/i), 'Gold Loan');
    await userEvent.type(screen.getByLabelText(/description/i), 'Against gold');
    await userEvent.type(screen.getByLabelText(/interest rate/i), '14');
    await userEvent.type(screen.getByLabelText(/min principal/i), '20000');
    await userEvent.type(screen.getByLabelText(/max principal/i), '300000');
    await userEvent.type(screen.getByLabelText(/min tenure/i), '15');
    await userEvent.type(screen.getByLabelText(/max tenure/i), '180');
    await userEvent.type(screen.getByLabelText(/min age/i), '21');
    await userEvent.type(screen.getByLabelText(/max age/i), '58');
    await userEvent.type(screen.getByLabelText(/min monthly salary/i), '20000');
    await userEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOLD', interestRate: 14, minPrincipal: 20000, maxPrincipal: 300000 }));
  });

  it('submits category', async () => {
    render(<ProductFormDialog trigger={<Button>New</Button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.type(screen.getByLabelText(/code/i), 'PERS');
    await userEvent.type(screen.getByLabelText(/^name/i), 'Personal Loan');
    await userEvent.type(screen.getByLabelText(/description/i), 'Unsecured loan');
    await userEvent.type(screen.getByLabelText(/interest rate/i), '12');
    await userEvent.type(screen.getByLabelText(/min principal/i), '10000');
    await userEvent.type(screen.getByLabelText(/max principal/i), '200000');
    await userEvent.type(screen.getByLabelText(/min tenure/i), '30');
    await userEvent.type(screen.getByLabelText(/max tenure/i), '365');
    await userEvent.type(screen.getByLabelText(/min age/i), '21');
    await userEvent.type(screen.getByLabelText(/max age/i), '60');
    await userEvent.type(screen.getByLabelText(/min monthly salary/i), '25000');
    await userEvent.type(screen.getByLabelText(/category/i), 'Personal');
    await userEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ category: 'Personal' }));
  });
});
