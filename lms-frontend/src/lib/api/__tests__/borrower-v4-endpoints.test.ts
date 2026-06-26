import { describe, it, expect, vi, beforeEach } from 'vitest';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../client', () => ({ apiFetch: fetchMock, ApiError: class extends Error {} }));
import { endpoints } from '../endpoints';

beforeEach(() => fetchMock.mockReset().mockResolvedValue({}));

describe('borrower v4 endpoints', () => {
  it('cancelLoan POSTs to the borrower cancel path', async () => {
    await endpoints.cancelLoan('L1', { reason: 'changed mind' });
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1/cancel', expect.objectContaining({ method: 'POST' }), undefined);
  });
  it('myLoanDetail GETs the borrower loan detail', async () => {
    await endpoints.myLoanDetail('L1');
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1', expect.objectContaining({ method: 'GET' }), undefined);
  });
  it('borrowerDocument GETs the document url', async () => {
    await endpoints.borrowerDocument('L1');
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1/document', expect.objectContaining({ method: 'GET' }), undefined);
  });
});
