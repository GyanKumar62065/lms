import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/upload-url'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/download-url'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

async function fullCycleLoan() {
  const borrower = request.agent(app);
  await signupBorrower(borrower);
  await borrower.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await borrower.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await borrower.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  const applied = await borrower.post('/api/v1/borrower/loans').send({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
  const id = applied.body._id;
  const total = applied.body.totalRepayment; // paise
  await (await loginAs('sanction@lms.test', 'Sanction@123')).post(`/api/v1/loans/${id}/sanction`).send({});
  await (await loginAs('disbursement@lms.test', 'Disburse@123')).post(`/api/v1/loans/${id}/disburse`).send({});
  await (await loginAs('collection@lms.test', 'Collect@123'))
    .post(`/api/v1/loans/${id}/payments`)
    .send({ utr: 'UTR-DETAIL-1', amount: total / 100, paidAt: new Date().toISOString() });
  return id;
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /loans/:id detail + timeline', () => {
  it('returns payments and an ordered audit timeline with actors', async () => {
    const id = await fullCycleLoan();
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get(`/api/v1/loans/${id}`);
    expect(res.status).toBe(200);

    // payments in rupees
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].utr).toBe('UTR-DETAIL-1');
    expect(res.body.payments[0].recordedBy.name).toBe('Collection Exec');

    // timeline ascending, covering the full lifecycle
    const types = res.body.timeline.map((t: any) => t.type);
    expect(types).toEqual(['STATUS', 'STATUS', 'STATUS', 'PAYMENT', 'STATUS']);
    const ats = res.body.timeline.map((t: any) => new Date(t.at).getTime());
    expect(ats).toEqual([...ats].sort((a, b) => a - b)); // ascending

    // actor attribution
    const sanctionEntry = res.body.timeline.find((t: any) => t.detail.includes('SANCTIONED'));
    expect(sanctionEntry.actor.name).toBe('Sanction Exec');
    const disburseEntry = res.body.timeline.find((t: any) => t.detail.includes('DISBURSED'));
    expect(disburseEntry.actor.name).toBe('Disbursement Exec');
    const closedEntry = res.body.timeline.find((t: any) => t.detail.includes('CLOSED'));
    expect(closedEntry).toBeTruthy();
  });

  it('404s an unknown loan', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans/64b0000000000000000000aa');
    expect(res.status).toBe(404);
  });
});
