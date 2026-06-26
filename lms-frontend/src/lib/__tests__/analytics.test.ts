import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/endpoints', () => ({ endpoints: { track: vi.fn().mockResolvedValue(undefined) } }));
import { track } from '../analytics';
import { endpoints } from '@/lib/api/endpoints';

beforeEach(() => vi.clearAllMocks());

describe('analytics track', () => {
  it('sends an event with name + path', async () => {
    await track('apply_clicked', { path: '/' });
    expect(endpoints.track).toHaveBeenCalledTimes(1);
    const arg = (endpoints.track as any).mock.calls[0][0];
    expect(arg[0].name).toBe('apply_clicked');
  });

  it('skips sending when doNotTrack is 1', async () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    await track('apply_clicked', { path: '/' });
    expect(endpoints.track).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });

  it('fills path from window.location.pathname when not provided', async () => {
    await track('landing_view');
    const arg = (endpoints.track as any).mock.calls[0][0];
    expect(arg[0].name).toBe('landing_view');
    expect(arg[0].path).toBeDefined();
  });
});
