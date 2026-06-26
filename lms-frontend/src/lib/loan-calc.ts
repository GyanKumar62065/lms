import { rupeesToPaise } from './money';
export const INTEREST_RATE = 12;
export function calcRepayment(principalRupees: number, tenureDays: number, rate: number = INTEREST_RATE) {
  const principalPaise = rupeesToPaise(principalRupees);
  const interestPaise = Math.round((principalPaise * rate * tenureDays) / (365 * 100));
  return { principalPaise, interestPaise, totalPaise: principalPaise + interestPaise };
}
