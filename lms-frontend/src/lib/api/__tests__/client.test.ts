import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from '../client';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api/api/v1');
});

describe('apiFetch', () => {
  it('returns json on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(apiFetch('/x')).resolves.toEqual({ ok: true });
  });
  it('refreshes once on 401 then retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 })) // first call
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 })); // retry
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/x')).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('throws ApiError with code on 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'bad', details: { failedRules: ['AGE'] } } }), { status: 422 }),
      ),
    );
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
  });
});
