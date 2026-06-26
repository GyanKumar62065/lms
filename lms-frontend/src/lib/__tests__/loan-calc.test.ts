import { describe, it, expect } from 'vitest';
import { calcRepayment } from '../loan-calc';
describe('loan calc', () => {
  it('matches backend for P=200000, T=60', () => {
    const r = calcRepayment(200000, 60);
    expect(r.principalPaise).toBe(20000000);
    expect(r.interestPaise).toBe(394521);
    expect(r.totalPaise).toBe(20000000 + 394521);
  });
  it('computes interest at 18% when rate=18', () => {
    const r = calcRepayment(200000, 60, 18);
    const expectedInterest = Math.round((20000000 * 18 * 60) / (365 * 100));
    expect(r.interestPaise).toBe(expectedInterest);
    expect(r.totalPaise).toBe(20000000 + expectedInterest);
  });
});
