import { describe, it, expect } from 'vitest';
import { isOpsUser } from '../auth/ops-home';

describe('isOpsUser', () => {
  it('true for ADMIN/SALES/etc', () => {
    expect(isOpsUser({ role: { code: 'ADMIN' } })).toBe(true);
    expect(isOpsUser({ role: { code: 'COLLECTION' } })).toBe(true);
  });
  it('false for BORROWER', () => {
    expect(isOpsUser({ role: { code: 'BORROWER' } })).toBe(false);
  });
});
