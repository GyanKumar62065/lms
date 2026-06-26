import { rupeesToPaise } from '../../lib/money';

// rupee-denominated definitions; converted to paise at seed time
export const SEED_PRODUCTS = [
  {
    code: 'PERSONAL',
    name: 'Personal Loan',
    description: 'A flexible personal loan for salaried and self-employed applicants.',
    interestRate: 12,
    minPrincipal: 50_000,
    maxPrincipal: 5_00_000,
    minTenureDays: 30,
    maxTenureDays: 365,
    eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25_000, employmentModes: ['Salaried', 'Self-Employed'] },
  },
  {
    code: 'SALARY_ADVANCE',
    name: 'Salary Advance',
    description: 'A short-tenure advance against your salary.',
    interestRate: 18,
    minPrincipal: 10_000,
    maxPrincipal: 1_00_000,
    minTenureDays: 7,
    maxTenureDays: 60,
    eligibility: { minAge: 21, maxAge: 55, minMonthlySalary: 15_000, employmentModes: ['Salaried'] },
  },
] as const;

export function productSeedToPaise(p: (typeof SEED_PRODUCTS)[number]) {
  return {
    code: p.code,
    name: p.name,
    description: p.description,
    interestRate: p.interestRate,
    minPrincipal: rupeesToPaise(p.minPrincipal),
    maxPrincipal: rupeesToPaise(p.maxPrincipal),
    minTenureDays: p.minTenureDays,
    maxTenureDays: p.maxTenureDays,
    eligibility: {
      minAge: p.eligibility.minAge,
      maxAge: p.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(p.eligibility.minMonthlySalary),
      employmentModes: [...p.eligibility.employmentModes],
    },
    status: 'ACTIVE' as const,
  };
}
