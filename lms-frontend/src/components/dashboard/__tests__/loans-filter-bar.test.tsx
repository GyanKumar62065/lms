// src/components/dashboard/__tests__/loans-filter-bar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { products: vi.fn() } }));
import { LoansFilterBar } from '../loans-filter-bar';

beforeEach(() => push.mockClear());

describe('LoansFilterBar', () => {
  it('pushes a query string with the typed search term', async () => {
    render(<LoansFilterBar current={{}} products={[]} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'rahul');
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('q=rahul'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/admin/loans?'));
  });
  it('clear resets to the bare route', async () => {
    render(<LoansFilterBar current={{ q: 'rahul' }} products={[]} />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(push).toHaveBeenCalledWith('/admin/loans');
  });
});
