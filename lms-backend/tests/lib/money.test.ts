import { rupeesToPaise, paiseToRupees, formatPaise } from '../../src/lib/money';

describe('money', () => {
  it('converts rupees to integer paise', () => {
    expect(rupeesToPaise(25000)).toBe(2500000);
    expect(rupeesToPaise(1999.99)).toBe(199999);
  });
  it('converts paise back to rupees', () => {
    expect(paiseToRupees(2500000)).toBe(25000);
  });
  it('rejects non-finite input', () => {
    expect(() => rupeesToPaise(NaN)).toThrow();
  });
});
