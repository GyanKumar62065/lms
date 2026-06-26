import { ConflictError } from '../../lib/errors';

export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED' | 'CANCELLED';
export type LoanAction = 'SANCTION' | 'REJECT' | 'DISBURSE' | 'CLOSE' | 'CANCEL';

const TRANSITIONS: Record<LoanAction, { from: LoanStatus | LoanStatus[]; to: LoanStatus }> = {
  SANCTION: { from: 'APPLIED', to: 'SANCTIONED' },
  REJECT: { from: 'APPLIED', to: 'REJECTED' },
  DISBURSE: { from: 'SANCTIONED', to: 'DISBURSED' },
  CLOSE: { from: 'DISBURSED', to: 'CLOSED' },
  CANCEL: { from: ['APPLIED', 'SANCTIONED'], to: 'CANCELLED' },
};

export function nextStatus(current: LoanStatus, action: LoanAction): LoanStatus {
  const t = TRANSITIONS[action];
  const allowed = Array.isArray(t.from) ? t.from : [t.from];
  if (!allowed.includes(current)) {
    throw new ConflictError(`Cannot ${action} a loan in status ${current}`);
  }
  return t.to;
}

export function assertTransition(current: LoanStatus, action: LoanAction): void {
  nextStatus(current, action);
}
