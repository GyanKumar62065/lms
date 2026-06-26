import { evaluateBre, computeAge, BreThresholds } from '../../src/lib/bre';

const asOf = new Date('2026-06-25');
const ok = {
  pan: 'ABCDE1234F',
  dob: new Date('1995-04-12'),
  monthlySalaryPaise: 4500000, // ₹45,000
  employmentMode: 'Salaried' as const,
  asOf,
};

describe('BRE', () => {
  it('computes age', () => {
    expect(computeAge(new Date('1995-04-12'), asOf)).toBe(31);
  });
  it('passes a fully valid applicant', () => {
    expect(evaluateBre(ok)).toEqual({ passed: true, failedRules: [] });
  });
  it('rejects under-23 and over-50', () => {
    expect(evaluateBre({ ...ok, dob: new Date('2010-01-01') }).failedRules).toContain('AGE');
    expect(evaluateBre({ ...ok, dob: new Date('1970-01-01') }).failedRules).toContain('AGE');
  });
  it('rejects salary below ₹25,000', () => {
    expect(evaluateBre({ ...ok, monthlySalaryPaise: 2499999 }).failedRules).toContain('SALARY');
  });
  it('rejects bad PAN format', () => {
    expect(evaluateBre({ ...ok, pan: 'abcde1234f' }).failedRules).toContain('PAN');
    expect(evaluateBre({ ...ok, pan: 'ABCD1234F' }).failedRules).toContain('PAN');
  });
  it('rejects unemployed', () => {
    expect(evaluateBre({ ...ok, employmentMode: 'Unemployed' }).failedRules).toContain('EMPLOYMENT');
  });
  it('passes age exactly 23 (inclusive lower bound)', () => {
    // born exactly 23 years before asOf
    const dob23 = new Date('2003-06-25');
    expect(evaluateBre({ ...ok, dob: dob23 }).failedRules).not.toContain('AGE');
  });
  it('passes age exactly 50 (inclusive upper bound)', () => {
    // born exactly 50 years before asOf
    const dob50 = new Date('1976-06-25');
    expect(evaluateBre({ ...ok, dob: dob50 }).failedRules).not.toContain('AGE');
  });
  it('fails age 22 (just under lower bound)', () => {
    // born one day after the 23rd birthday threshold → age is 22
    const dob22 = new Date('2003-06-26');
    expect(evaluateBre({ ...ok, dob: dob22 }).failedRules).toContain('AGE');
  });
  it('fails age 51 (just over upper bound)', () => {
    // born exactly 51 years before asOf → age is 51
    const dob51 = new Date('1975-06-25');
    expect(evaluateBre({ ...ok, dob: dob51 }).failedRules).toContain('AGE');
  });
  it('passes salary exactly 2_500_000 paise (inclusive lower bound)', () => {
    expect(evaluateBre({ ...ok, monthlySalaryPaise: 2_500_000 }).failedRules).not.toContain('SALARY');
  });
  it('fails salary 2_499_999 paise (one paise below threshold)', () => {
    expect(evaluateBre({ ...ok, monthlySalaryPaise: 2_499_999 }).failedRules).toContain('SALARY');
  });
});

describe('evaluateBre product thresholds', () => {
  const base = { pan: 'ABCDE1234F', dob: new Date('1995-04-12'), monthlySalaryPaise: 2_000_000, employmentMode: 'Salaried' as const, asOf: new Date('2026-06-25') };

  it('uses global defaults when thresholds omitted (₹20k < ₹25k fails SALARY)', () => {
    expect(evaluateBre(base).failedRules).toContain('SALARY');
  });
  it('passes a looser product threshold (₹15k floor)', () => {
    const t: BreThresholds = { minAge: 21, maxAge: 55, minMonthlySalaryPaise: 1_500_000, employmentModes: ['Salaried'] };
    expect(evaluateBre(base, t)).toEqual({ passed: true, failedRules: [] });
  });
  it('fails EMPLOYMENT when mode not in the product allow-list', () => {
    const t: BreThresholds = { minAge: 21, maxAge: 55, minMonthlySalaryPaise: 1_500_000, employmentModes: ['Salaried'] };
    const res = evaluateBre({ ...base, employmentMode: 'Self-Employed' }, t);
    expect(res.failedRules).toContain('EMPLOYMENT');
  });
  it('fails AGE against a stricter product window', () => {
    const t: BreThresholds = { minAge: 40, maxAge: 50, minMonthlySalaryPaise: 1_000_000, employmentModes: ['Salaried'] };
    expect(evaluateBre(base, t).failedRules).toContain('AGE'); // borrower is 31 in 2026
  });
});
