export type EmploymentMode = 'Salaried' | 'Self-Employed' | 'Unemployed';
export type BreRuleCode = 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function age(dob: Date, asOf: Date): number {
  let a = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) a--;
  return a;
}

export function evaluateBreClient(input: {
  pan: string;
  dob: Date;
  monthlySalary: number; // rupees
  employmentMode: EmploymentMode;
  asOf?: Date;
}): { passed: boolean; failedRules: BreRuleCode[] } {
  const asOf = input.asOf ?? new Date();
  const failed: BreRuleCode[] = [];
  const a = age(input.dob, asOf);
  if (a < 23 || a > 50) failed.push('AGE');
  if (input.monthlySalary < 25000) failed.push('SALARY');
  if (!PAN_REGEX.test(input.pan)) failed.push('PAN');
  if (input.employmentMode === 'Unemployed') failed.push('EMPLOYMENT');
  return { passed: failed.length === 0, failedRules: failed };
}
