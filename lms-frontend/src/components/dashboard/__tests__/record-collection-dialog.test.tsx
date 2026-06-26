// src/components/dashboard/__tests__/record-collection-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { recordPayment, refresh } = vi.hoisted(() => ({ recordPayment: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { recordPayment } }));
import { RecordCollectionDialog } from '../record-collection-dialog';

beforeEach(() => { recordPayment.mockReset(); refresh.mockReset(); });

describe('RecordCollectionDialog', () => {
  it('records a collection entry', async () => {
    recordPayment.mockResolvedValue({ loan: { status: 'DISBURSED', outstanding: 100000 }, payment: {} });
    render(<RecordCollectionDialog loan={{ _id: 'L1', outstanding: 20394521 } as any} trigger={<button>Record Collection</button>} />);
    await userEvent.click(screen.getByRole('button', { name: /record collection/i }));
    await userEvent.type(screen.getByLabelText(/utr/i), 'UTR-1');
    await userEvent.type(screen.getByLabelText(/amount/i), '5000');
    await userEvent.type(screen.getByLabelText(/date/i), '2026-06-26');
    await userEvent.click(screen.getByRole('button', { name: /^record$/i }));
    expect(recordPayment).toHaveBeenCalledWith('L1', expect.objectContaining({ utr: 'UTR-1', amount: 5000, paidAt: '2026-06-26' }));
  });
});
