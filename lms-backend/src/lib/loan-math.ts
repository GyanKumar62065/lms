export const INTEREST_RATE = 12; // % p.a., fixed

export function computeSimpleInterest(principalPaise: number, tenureDays: number, rate: number = INTEREST_RATE): number {
  if (!Number.isInteger(principalPaise) || principalPaise <= 0) throw new Error('invalid principal');
  if (!Number.isInteger(tenureDays) || tenureDays <= 0) throw new Error('invalid tenure');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('invalid rate');
  return Math.round((principalPaise * rate * tenureDays) / (365 * 100));
}

export function computeRepayment(principalPaise: number, tenureDays: number, rate: number = INTEREST_RATE) {
  const simpleInterest = computeSimpleInterest(principalPaise, tenureDays, rate);
  return { principal: principalPaise, simpleInterest, totalRepayment: principalPaise + simpleInterest };
}
