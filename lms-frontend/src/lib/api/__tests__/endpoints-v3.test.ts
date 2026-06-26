import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endpoints } from '../endpoints';

beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api/api/v1'); });

function stubJson(payload: unknown) {
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal('fetch', f);
  return f;
}

describe('v3 endpoints', () => {
  it('adminMetrics hits /admin/metrics', async () => {
    const f = stubJson({ kpis: {} });
    await endpoints.adminMetrics();
    expect(f.mock.calls[0][0]).toContain('/admin/metrics');
  });
  it('loanDetail hits /loans/:id', async () => {
    const f = stubJson({ _id: 'L1' });
    await endpoints.loanDetail('L1');
    expect(f.mock.calls[0][0]).toContain('/loans/L1');
  });
  it('loans builds a query string from filters (skips empty values)', async () => {
    const f = stubJson({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
    await endpoints.loans({ status: 'DISBURSED', productCode: 'PERSONAL', q: 'rahul', minAmount: 50000, sort: '-createdAt', page: 2 });
    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('/loans?');
    expect(url).toContain('status=DISBURSED');
    expect(url).toContain('productCode=PERSONAL');
    expect(url).toContain('q=rahul');
    expect(url).toContain('minAmount=50000');
    expect(url).toContain('sort=-createdAt');
    expect(url).toContain('page=2');
    expect(url).not.toContain('maxAmount');
  });
  it('loans with no filters hits bare /loans', async () => {
    const f = stubJson({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
    await endpoints.loans();
    expect(f.mock.calls[0][0]).toMatch(/\/loans$/);
  });
});
