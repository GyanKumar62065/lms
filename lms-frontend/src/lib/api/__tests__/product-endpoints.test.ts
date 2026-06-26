import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('@/lib/api/client', () => ({ apiFetch, ApiError: class extends Error {} }));
import { endpoints } from '../endpoints';

beforeEach(() => apiFetch.mockClear());

describe('product endpoints', () => {
  it('publicProducts GETs /public/products', async () => {
    await endpoints.publicProducts();
    expect(apiFetch).toHaveBeenCalledWith('/public/products', { method: 'GET' }, undefined);
  });
  it('product(code) GETs /products/:code', async () => {
    await endpoints.product('PERSONAL');
    expect(apiFetch).toHaveBeenCalledWith('/products/PERSONAL', { method: 'GET' }, undefined);
  });
  it('createProduct POSTs /admin/products', async () => {
    await endpoints.createProduct({ code: 'X' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/products', { method: 'POST', body: JSON.stringify({ code: 'X' }) }, undefined);
  });
  it('activateProduct POSTs /admin/products/:id/activate', async () => {
    await endpoints.activateProduct('id1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/products/id1/activate', { method: 'POST', body: undefined }, undefined);
  });
  it('apply includes productCode', async () => {
    await endpoints.apply({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(apiFetch).toHaveBeenCalledWith('/borrower/loans', { method: 'POST', body: JSON.stringify({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 }) }, undefined);
  });
});
