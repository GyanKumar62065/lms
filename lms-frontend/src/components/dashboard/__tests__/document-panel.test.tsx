// src/components/dashboard/__tests__/document-panel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { loanDocument } = vi.hoisted(() => ({ loanDocument: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { loanDocument } }));
import { DocumentPanel } from '../document-panel';

beforeEach(() => loanDocument.mockReset());

describe('DocumentPanel', () => {
  it('loads and previews a pdf with a download link', async () => {
    loanDocument.mockResolvedValue({ url: 'http://minio/doc.pdf?sig=1', filename: 'slip.pdf', mime: 'application/pdf' });
    render(<DocumentPanel loanId="L1" />);
    await userEvent.click(screen.getByRole('button', { name: /view document/i }));
    expect(loanDocument).toHaveBeenCalledWith('L1');
    expect(await screen.findByTitle(/document preview/i)).toBeInTheDocument(); // iframe
    const dl = screen.getByRole('link', { name: /download/i });
    expect(dl).toHaveAttribute('href', 'http://minio/doc.pdf?sig=1');
  });
});
