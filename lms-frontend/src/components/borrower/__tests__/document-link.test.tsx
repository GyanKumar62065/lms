import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { borrowerDocument, openSpy } = vi.hoisted(() => ({ borrowerDocument: vi.fn(), openSpy: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { borrowerDocument } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { DocumentLink } from '../document-link';
beforeEach(() => {
  borrowerDocument.mockReset().mockResolvedValue({ url: 'http://x/doc.pdf', filename: 'doc.pdf', mime: 'application/pdf' });
  (window as any).open = openSpy;
  openSpy.mockReset();
});
describe('DocumentLink', () => {
  it('fetches a presigned url and opens it', async () => {
    render(<DocumentLink loanId="L1" />);
    await userEvent.click(screen.getByRole('button', { name: /document/i }));
    expect(borrowerDocument).toHaveBeenCalledWith('L1');
    expect(openSpy).toHaveBeenCalledWith('http://x/doc.pdf', '_blank');
  });
});
