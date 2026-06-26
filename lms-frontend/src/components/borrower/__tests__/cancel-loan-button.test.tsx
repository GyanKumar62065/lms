import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { cancelLoan, refresh, toastSuccess } = vi.hoisted(() => ({ cancelLoan: vi.fn(), refresh: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { cancelLoan } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn() }) }));
import { CancelLoanButton } from '../cancel-loan-button';

beforeEach(() => { cancelLoan.mockReset().mockResolvedValue({}); refresh.mockReset(); });
describe('CancelLoanButton', () => {
  it('is not rendered for DISBURSED loans', () => {
    const { container } = render(<CancelLoanButton loanId="L1" status="DISBURSED" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('is not rendered for CLOSED loans', () => {
    const { container } = render(<CancelLoanButton loanId="L1" status="CLOSED" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('is not rendered for REJECTED loans', () => {
    const { container } = render(<CancelLoanButton loanId="L1" status="REJECTED" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('is not rendered for CANCELLED loans', () => {
    const { container } = render(<CancelLoanButton loanId="L1" status="CANCELLED" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('renders a cancel button for APPLIED loans', () => {
    render(<CancelLoanButton loanId="L1" status="APPLIED" />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
  it('renders a cancel button for SANCTIONED loans', () => {
    render(<CancelLoanButton loanId="L1" status="SANCTIONED" />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
  it('cancels an APPLIED loan after confirm', async () => {
    render(<CancelLoanButton loanId="L1" status="APPLIED" />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(cancelLoan).toHaveBeenCalledWith('L1');
    expect(refresh).toHaveBeenCalled();
  });
  it('cancels a SANCTIONED loan after confirm', async () => {
    render(<CancelLoanButton loanId="L1" status="SANCTIONED" />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(cancelLoan).toHaveBeenCalledWith('L1');
    expect(refresh).toHaveBeenCalled();
  });
});
