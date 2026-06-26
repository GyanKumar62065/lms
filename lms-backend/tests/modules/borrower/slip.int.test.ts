import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/upload-url'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/download-url'),
}));

let mem: MongoMemoryServer;
const app = createApp();

async function eligibleBorrower() {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
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

describe('salary slip', () => {
  it('returns a presigned url and object key', async () => {
    const agent = await eligibleBorrower();
    const res = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe('http://minio/upload-url');
    expect(res.body.objectKey).toBeDefined();
  });
  it('stages the slip on the profile', async () => {
    const agent = await eligibleBorrower();
    const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
    const res = await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 'slip.pdf', mime: 'application/pdf', size: 1000 });
    expect(res.status).toBe(200);
  });
});
