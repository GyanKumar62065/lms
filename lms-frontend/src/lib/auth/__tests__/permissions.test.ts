import { describe, it, expect } from 'vitest';
import { hasPermission } from '../session';
const me = { id: '1', fullName: 'A', email: 'a@x', role: { code: 'SANCTION', name: 'Sanction' }, permissions: ['loan:sanction', 'loan:read:all'] };
describe('hasPermission', () => {
  it('true when present', () => expect(hasPermission(me as any, 'loan:sanction')).toBe(true));
  it('false when absent', () => expect(hasPermission(me as any, 'payment:create')).toBe(false));
});
