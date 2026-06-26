import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { push, login, params } = vi.hoisted(() => ({
  push: vi.fn(), login: vi.fn(), params: { get: vi.fn(() => null) },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }), useSearchParams: () => params }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { login } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { AuthForm } from '../auth-form';

beforeEach(() => { push.mockReset(); login.mockReset(); params.get.mockReturnValue(null); });

async function submit() {
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
}
describe('AuthForm role redirect (login response carries role + permissions)', () => {
  it('sends a borrower to / by default', async () => {
    login.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: ['loan:apply'] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/');
  });
  it('sends an ops user to their ops home', async () => {
    login.mockResolvedValue({ role: { code: 'SANCTION' }, permissions: ['loan:sanction'] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/sanction');
  });
  it('honors an explicit next for an ops user', async () => {
    params.get.mockReturnValue('/admin/loans');
    login.mockResolvedValue({ role: { code: 'ADMIN' }, permissions: ['metrics:read'] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/admin/loans');
  });
  it('honors an explicit next for a borrower', async () => {
    params.get.mockReturnValue('/apply?product=PERSONAL');
    login.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: [] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/apply?product=PERSONAL');
  });
});
