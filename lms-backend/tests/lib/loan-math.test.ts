import { computeSimpleInterest, computeRepayment, INTEREST_RATE } from '../../src/lib/loan-math';

describe('loan math', () => {
  it('fixes the interest rate at 12', () => {
    expect(INTEREST_RATE).toBe(12);
  });
  it('computes simple interest in paise (P=200000, T=60)', () => {
    // SI = 20000000 * 12 * 60 / (365*100) = 394520.547... -> round 394521
    expect(computeSimpleInterest(20000000, 60)).toBe(394521);
  });
  it('computes total repayment', () => {
    const r = computeRepayment(20000000, 60);
    expect(r.simpleInterest).toBe(394521);
    expect(r.totalRepayment).toBe(20000000 + 394521);
  });
});

describe('loan-math rate parameter', () => {
  it('defaults to INTEREST_RATE when rate is omitted', () => {
    expect(computeSimpleInterest(20_000_000, 60)).toBe(computeSimpleInterest(20_000_000, 60, INTEREST_RATE));
  });
  it('uses the provided rate', () => {
    // 20,000,000 paise * 18 * 60 / (365*100) = 591,780.8 -> round 591781
    expect(computeSimpleInterest(20_000_000, 60, 18)).toBe(591781);
  });
  it('computeRepayment honours the rate', () => {
    const r = computeRepayment(20_000_000, 60, 18);
    expect(r.simpleInterest).toBe(591781);
    expect(r.totalRepayment).toBe(20_000_000 + 591781);
  });
});
