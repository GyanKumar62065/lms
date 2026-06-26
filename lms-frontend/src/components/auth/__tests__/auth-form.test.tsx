import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../auth-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

describe('AuthForm', () => {
  it('shows a validation error for a bad email on login', async () => {
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });
});
