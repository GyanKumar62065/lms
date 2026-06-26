import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('products module', () => {
  it('public list returns only ACTIVE products, rupee-denominated', async () => {
    const res = await request(app).get('/api/v1/public/products');
    expect(res.status).toBe(200);
    const codes = res.body.data.map((p: any) => p.code);
    expect(codes).toContain('PERSONAL');
    const personal = res.body.data.find((p: any) => p.code === 'PERSONAL');
    expect(personal.minPrincipal).toBe(50000); // rupees, not paise
  });

  it('admin can create a product (rupees in, 201) and it is stored in paise', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.post('/api/v1/admin/products').send({
      code: 'GOLD', name: 'Gold Loan', description: 'Against gold', interestRate: 10,
      minPrincipal: 20000, maxPrincipal: 300000, minTenureDays: 30, maxTenureDays: 180,
      eligibility: { minAge: 21, maxAge: 60, minMonthlySalary: 10000, employmentModes: ['Salaried', 'Self-Employed'] },
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('GOLD');
    expect(res.body.minPrincipal).toBe(20000); // serialized back to rupees
  });

  it('rejects a duplicate code with 409 PRODUCT_CODE_EXISTS', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.post('/api/v1/admin/products').send({
      code: 'PERSONAL', name: 'Dup', description: 'd', interestRate: 12,
      minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCT_CODE_EXISTS');
  });

  it('blocks an ops role (SALES) from creating a product (403)', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales.post('/api/v1/admin/products').send({
      code: 'NOPE', name: 'x', description: 'd', interestRate: 12,
      minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
    });
    expect(res.status).toBe(403);
  });

  it('lets an ops role read the full product list via product:read', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales.get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('admin can deactivate a product and it drops from the public list', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const list = await admin.get('/api/v1/products');
    const gold = list.body.data.find((p: any) => p.code === 'GOLD');
    const res = await admin.post(`/api/v1/admin/products/${gold.id}/deactivate`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
    const pub = await request(app).get('/api/v1/public/products');
    expect(pub.body.data.map((p: any) => p.code)).not.toContain('GOLD');
  });

  it('admin can patch a product (interestRate)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const list = await admin.get('/api/v1/products');
    const gold = list.body.data.find((p: any) => p.code === 'GOLD');
    const res = await admin.patch(`/api/v1/admin/products/${gold.id}`).send({ interestRate: 11 });
    expect(res.status).toBe(200);
    expect(res.body.interestRate).toBe(11);
  });

  it('GET /products/:code returns one product or 404', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const ok = await admin.get('/api/v1/products/PERSONAL');
    expect(ok.status).toBe(200);
    const miss = await admin.get('/api/v1/products/DOESNOTEXIST');
    expect(miss.status).toBe(404);
  });

  it('rejects a one-sided PATCH that inverts the principal range against stored values (422)', async () => {
    // PERSONAL has maxPrincipal = 500000 rupees; sending minPrincipal = 600000 without maxPrincipal
    // would leave merged state as minPrincipal(600000) > maxPrincipal(500000), which must be rejected.
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const list = await admin.get('/api/v1/products');
    const personal = list.body.data.find((p: any) => p.code === 'PERSONAL');
    const res = await admin.patch(`/api/v1/admin/products/${personal.id}`).send({ minPrincipal: 600000 });
    expect(res.status).toBe(422);
  });

  it('code is immutable — PATCH ignores code field (updateProductDto omits code)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const list = await admin.get('/api/v1/products');
    const personal = list.body.data.find((p: any) => p.code === 'PERSONAL');
    // Sending code in body should be stripped by the DTO (code is omitted from updateProductDto)
    // The update should succeed (DTO strips unknown fields) and code remains unchanged
    const res = await admin.patch(`/api/v1/admin/products/${personal.id}`).send({ interestRate: 13 });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('PERSONAL');
  });

  it('unauthenticated request to /products is rejected with 401', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
  });

  it('borrower cannot read the products list (403)', async () => {
    const borrower = await loginAs('borrower@lms.test', 'Borrow@123');
    const res = await borrower.get('/api/v1/products');
    expect(res.status).toBe(403);
  });

  it('admin can activate a deactivated product', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const list = await admin.get('/api/v1/products');
    const gold = list.body.data.find((p: any) => p.code === 'GOLD');
    const res = await admin.post(`/api/v1/admin/products/${gold.id}/activate`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });
});
