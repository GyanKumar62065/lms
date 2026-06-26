import { describe, it, expect } from 'vitest';
import { evaluateBreClient } from '../bre';
const asOf = new Date('2026-06-25');
describe('client BRE', () => {
  it('passes a valid applicant', () => {
    expect(evaluateBreClient({ pan: 'ABCDE1234F', dob: new Date('1995-04-12'), monthlySalary: 45000, employmentMode: 'Salaried', asOf }).passed).toBe(true);
  });
  it('flags age, salary, employment', () => {
    const r = evaluateBreClient({ pan: 'ABCDE1234F', dob: new Date('1960-01-01'), monthlySalary: 1000, employmentMode: 'Unemployed', asOf });
    expect(r.failedRules).toEqual(expect.arrayContaining(['AGE', 'SALARY', 'EMPLOYMENT']));
  });
});
