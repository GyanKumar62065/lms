// Centralized apply call so the product-scoped body lives in ONE place
// (mirrors the v2 signupBorrower cascade lesson).
export function applyLoan(
  agent: any,
  over: { productCode?: string; principal?: number; tenureDays?: number } = {},
) {
  return agent.post('/api/v1/borrower/loans').send({
    productCode: 'PERSONAL',
    principal: 200000,
    tenureDays: 60,
    ...over,
  });
}
