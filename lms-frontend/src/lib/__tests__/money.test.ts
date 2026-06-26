import { describe, it, expect } from 'vitest';
import { formatRupees, formatRupeesAmount, rupeesToPaise } from '../money';
describe('money', () => {
  it('formats paise as INR', () => {
    expect(formatRupees(20000000)).toBe('₹2,00,000');
  });
  it('converts rupees to paise', () => {
    expect(rupeesToPaise(2000)).toBe(200000);
  });

  describe('formatRupeesAmount (loan-detail payment amounts — already in rupees)', () => {
    it('renders ₹500 for amount=500 (regression: formatRupees would wrongly render ₹5)', () => {
      // The backend returns payments[].amount in RUPEES. formatRupeesAmount must NOT divide by 100.
      expect(formatRupeesAmount(500)).toBe('₹500');
      // Sanity-check: old formatter would have produced ₹5
      expect(formatRupees(500)).toBe('₹5');
    });
    it('renders ₹1,000 for amount=1000', () => {
      expect(formatRupeesAmount(1000)).toBe('₹1,000');
    });
  });
});
