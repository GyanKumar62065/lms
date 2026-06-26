import { describe, it, expect } from 'vitest';
import { opsHome } from '../ops-home';
describe('opsHome', () => {
  it('prefers Overview for metrics:read', () => {
    expect(opsHome(['metrics:read', 'loan:sanction'])).toBe('/admin/overview');
  });
  it('falls to the first permitted queue', () => {
    expect(opsHome(['loan:disburse'])).toBe('/disbursement');
  });
  it('defaults to /sanction when nothing matches', () => {
    expect(opsHome([])).toBe('/sanction');
  });
});
