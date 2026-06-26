export type EmploymentMode = 'Salaried' | 'Self-Employed' | 'Unemployed';
export type BreRuleCode = 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MIN_SALARY_PAISE = 2_500_000; // ₹25,000
const MIN_AGE = 23;
const MAX_AGE = 50;

export type BreThresholds = {
  minAge: number;
  maxAge: number;
  minMonthlySalaryPaise: number;
  employmentModes?: EmploymentMode[];
};

const DEFAULT_THRESHOLDS: BreThresholds = {
  minAge: MIN_AGE,
  maxAge: MAX_AGE,
  minMonthlySalaryPaise: MIN_SALARY_PAISE,
  // employmentModes omitted -> legacy "fails only when Unemployed"
};

export function computeAge(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

export function evaluateBre(
  input: { pan: string; dob: Date; monthlySalaryPaise: number; employmentMode: EmploymentMode; asOf?: Date },
  thresholds: BreThresholds = DEFAULT_THRESHOLDS,
): { passed: boolean; failedRules: BreRuleCode[] } {
  const asOf = input.asOf ?? new Date();
  const failed: BreRuleCode[] = [];
  const age = computeAge(input.dob, asOf);
  if (age < thresholds.minAge || age > thresholds.maxAge) failed.push('AGE');
  if (input.monthlySalaryPaise < thresholds.minMonthlySalaryPaise) failed.push('SALARY');
  if (!PAN_REGEX.test(input.pan)) failed.push('PAN');
  if (thresholds.employmentModes) {
    if (!thresholds.employmentModes.includes(input.employmentMode)) failed.push('EMPLOYMENT');
  } else if (input.employmentMode === 'Unemployed') {
    failed.push('EMPLOYMENT');
  }
  return { passed: failed.length === 0, failedRules: failed };
}
