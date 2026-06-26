import { nextStatus } from '../../../src/modules/loans/state-machine';
import { ConflictError } from '../../../src/lib/errors';

describe('loan state machine', () => {
  it('APPLIED -> SANCTION -> SANCTIONED', () => {
    expect(nextStatus('APPLIED', 'SANCTION')).toBe('SANCTIONED');
  });
  it('APPLIED -> REJECT -> REJECTED', () => {
    expect(nextStatus('APPLIED', 'REJECT')).toBe('REJECTED');
  });
  it('SANCTIONED -> DISBURSE -> DISBURSED', () => {
    expect(nextStatus('SANCTIONED', 'DISBURSE')).toBe('DISBURSED');
  });
  it('DISBURSED -> CLOSE -> CLOSED', () => {
    expect(nextStatus('DISBURSED', 'CLOSE')).toBe('CLOSED');
  });
  it('rejects illegal transition (DISBURSE on APPLIED)', () => {
    expect(() => nextStatus('APPLIED', 'DISBURSE')).toThrow(ConflictError);
  });
  it('rejects acting on a closed loan', () => {
    expect(() => nextStatus('CLOSED', 'DISBURSE')).toThrow(ConflictError);
  });
});

describe('CANCEL transition', () => {
  it('allows CANCEL from APPLIED and SANCTIONED', () => {
    expect(nextStatus('APPLIED', 'CANCEL')).toBe('CANCELLED');
    expect(nextStatus('SANCTIONED', 'CANCEL')).toBe('CANCELLED');
  });
  it('rejects CANCEL from DISBURSED/CLOSED/REJECTED/CANCELLED', () => {
    for (const s of ['DISBURSED', 'CLOSED', 'REJECTED', 'CANCELLED'] as const) {
      expect(() => nextStatus(s as any, 'CANCEL')).toThrow(/Cannot CANCEL a loan in status/);
    }
  });
});
