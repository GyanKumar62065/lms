import request from 'supertest';
import { createApp } from '../../../src/app';
const app = createApp();
describe('GET /public/config', () => {
  it('returns loan params + eligibility', async () => {
    const res = await request(app).get('/api/v1/public/config');
    expect(res.status).toBe(200);
    expect(res.body.loan.interestRate).toBe(12);
    expect(res.body.loan.minPrincipal).toBe(50000);
    expect(res.body.eligibility.minAge).toBe(23);
    expect(res.body.eligibility.minMonthlySalary).toBe(25000);
  });
});
