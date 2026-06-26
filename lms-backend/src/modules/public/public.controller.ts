import { Request, Response } from 'express';
import { INTEREST_RATE } from '../../lib/loan-math';

export function getPublicConfig(_req: Request, res: Response) {
  res.json({
    loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: INTEREST_RATE, minTenureDays: 30, maxTenureDays: 365 },
    eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried', 'Self-Employed'] },
  });
}
