import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.mock is hoisted above this file, so mock vars must be created via vi.hoisted (else TDZ)
const { push, toastMessage } = vi.hoisted(() => ({ push: vi.fn(), toastMessage: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/analytics', () => ({ trackApplyClicked: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { message: toastMessage }) }));
import { ApplyCTA } from '../apply-cta';

beforeEach(() => {
  push.mockClear();
  toastMessage.mockClear();
});
describe('ApplyCTA', () => {
  it('routes anonymous users to /login?next=/apply', async () => {
    render(<ApplyCTA me={null} />);
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith('/login?next=/apply');
  });
  it('routes a borrower to /apply', async () => {
    render(<ApplyCTA me={{ role: { code: 'BORROWER' } } as any} />);
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith('/apply');
  });
  it('sends a staff/admin user to /dashboard with a toast', async () => {
    render(<ApplyCTA me={{ role: { code: 'SANCTION' } } as any} />);
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(toastMessage).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});
