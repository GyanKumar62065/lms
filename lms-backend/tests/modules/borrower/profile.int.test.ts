import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';

let mem: MongoMemoryServer;
const app = createApp();

async function borrowerAgent() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  return agent;
}

beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('borrower profile + BRE', () => {
  it('accepts an eligible applicant', async () => {
    const agent = await borrowerAgent();
    const res = await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried',
    });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.passed).toBe(true);
  });
  it('rejects an ineligible applicant with 422 + failedRules', async () => {
    const agent = await borrowerAgent();
    const res = await agent.put('/api/v1/borrower/profile').send({
      fullName: 'Old', pan: 'ABCDE1234F', dob: '1960-01-01', monthlySalary: 10000, employmentMode: 'Unemployed',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.failedRules).toEqual(expect.arrayContaining(['AGE', 'SALARY', 'EMPLOYMENT']));
  });
  it('blocks unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/borrower/profile');
    expect(res.status).toBe(401);
  });
});
