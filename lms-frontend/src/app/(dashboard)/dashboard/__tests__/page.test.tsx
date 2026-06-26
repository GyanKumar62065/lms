import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(() => { throw new Error('REDIRECT'); }),
}));
vi.mock('@/lib/auth/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({ redirect }));

import DashboardIndex from '../page';

beforeEach(() => { getSession.mockReset(); redirect.mockClear(); });

describe('DashboardIndex redirect', () => {
  it('redirects null session to login', async () => {
    getSession.mockResolvedValue(null);
    await expect(DashboardIndex()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?next=/dashboard');
  });

  it('redirects a loan:sanction user to /sanction', async () => {
    getSession.mockResolvedValue({ permissions: ['loan:sanction'] });
    await expect(DashboardIndex()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/sanction');
  });

  it('redirects a metrics:read user to /admin/overview', async () => {
    getSession.mockResolvedValue({ permissions: ['metrics:read', 'loan:sanction'] });
    await expect(DashboardIndex()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/admin/overview');
  });

  it('redirects a user with no recognised perms to /sanction (opsHome default)', async () => {
    getSession.mockResolvedValue({ permissions: ['loan:read:own'] });
    await expect(DashboardIndex()).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/sanction');
  });
});
