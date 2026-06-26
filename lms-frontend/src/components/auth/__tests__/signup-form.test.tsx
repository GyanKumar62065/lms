import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { getCaptcha: vi.fn().mockResolvedValue({ captchaId: 'c', svg: '<svg/>' }), signup: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ trackSignupStarted: vi.fn(), trackSignupCompleted: vi.fn() }));
import { SignupForm } from '../signup-form';

describe('SignupForm', () => {
  it('shows a confirm-password mismatch error', async () => {
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/first name/i), 'A');
    await userEvent.type(screen.getByLabelText(/last name/i), 'B');
    await userEvent.type(screen.getByLabelText(/email/i), 'a@x.com');
    await userEvent.type(screen.getByLabelText(/phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Passw0rd!');
    await userEvent.type(screen.getByLabelText(/confirm/i), 'different');
    await userEvent.type(screen.getByLabelText(/captcha/i), 'abcde');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });
});
