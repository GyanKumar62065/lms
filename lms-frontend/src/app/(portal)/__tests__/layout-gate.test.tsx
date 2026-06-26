import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getSession, redirect } = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));
vi.mock('@/lib/auth/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({ redirect }));
import PortalLayout from '../layout';

beforeEach(() => { getSession.mockReset(); redirect.mockClear(); });
describe('(portal) layout gate', () => {
  it('redirects an ops user to their ops home', async () => {
    getSession.mockResolvedValue({ role: { code: 'SANCTION' }, permissions: ['loan:sanction'] });
    await expect(PortalLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/sanction');
  });
  it('lets a borrower through', async () => {
    getSession.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: ['loan:apply'] });
    await expect(PortalLayout({ children: null })).resolves.toBeTruthy();
  });
});
