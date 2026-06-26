import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endpoints } from '../endpoints';

beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api/api/v1'); });

describe('v2 endpoints', () => {
  it('getCaptcha hits /auth/captcha', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ captchaId: 'x', svg: '<svg/>' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await endpoints.getCaptcha();
    expect(r.captchaId).toBe('x');
    expect(f.mock.calls[0][0]).toContain('/auth/captcha');
  });
  it('publicConfig hits /public/config', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ loan: { interestRate: 12 } }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await endpoints.publicConfig();
    expect((r as any).loan.interestRate).toBe(12);
    expect(f.mock.calls[0][0]).toContain('/public/config');
  });
});
