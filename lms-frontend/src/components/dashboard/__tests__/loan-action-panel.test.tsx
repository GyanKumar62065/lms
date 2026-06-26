// src/components/dashboard/__tests__/loan-action-panel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { push, refresh, sanction, disburse, recordPayment } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), sanction: vi.fn(), disburse: vi.fn(), recordPayment: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { sanction, disburse, reject: vi.fn(), recordPayment } }));
import { LoanActionPanel } from '../loan-action-panel';

beforeEach(() => { sanction.mockReset(); disburse.mockReset(); refresh.mockReset(); recordPayment.mockReset(); });

describe('LoanActionPanel', () => {
  it('approves an APPLIED loan with loan:sanction', async () => {
    sanction.mockResolvedValue({});
    render(<LoanActionPanel loan={{ _id: 'L1', status: 'APPLIED' } as any} permissions={['loan:sanction']} />);
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(sanction).toHaveBeenCalledWith('L1');
  });
  it('shows Disburse for a SANCTIONED loan with loan:disburse', () => {
    render(<LoanActionPanel loan={{ _id: 'L1', status: 'SANCTIONED' } as any} permissions={['loan:disburse']} />);
    expect(screen.getByRole('button', { name: /disburse/i })).toBeInTheDocument();
  });
  it('renders nothing without the matching permission', () => {
    const { container } = render(<LoanActionPanel loan={{ _id: 'L1', status: 'APPLIED' } as any} permissions={['payment:create']} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows Record Collection for a DISBURSED loan with payment:create', () => {
    render(<LoanActionPanel loan={{ _id: 'L1', status: 'DISBURSED', outstanding: 500000 } as any} permissions={['payment:create']} />);
    expect(screen.getByRole('button', { name: /record collection/i })).toBeInTheDocument();
  });
  it('renders nothing for DISBURSED without payment:create', () => {
    const { container } = render(<LoanActionPanel loan={{ _id: 'L1', status: 'DISBURSED', outstanding: 500000 } as any} permissions={['loan:sanction']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
