import { paiseToRupees } from '../../lib/money';
import { ILoanProduct } from '../../models/loan-product.model';

export function serializeProduct(p: ILoanProduct) {
  return {
    id: p._id.toString(),
    code: p.code,
    name: p.name,
    description: p.description,
    interestRate: p.interestRate,
    minPrincipal: paiseToRupees(p.minPrincipal),
    maxPrincipal: paiseToRupees(p.maxPrincipal),
    minTenureDays: p.minTenureDays,
    maxTenureDays: p.maxTenureDays,
    eligibility: {
      minAge: p.eligibility.minAge,
      maxAge: p.eligibility.maxAge,
      minMonthlySalary: paiseToRupees(p.eligibility.minMonthlySalary),
      employmentModes: p.eligibility.employmentModes,
    },
    category: p.category,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
