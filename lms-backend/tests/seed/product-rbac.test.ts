import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runSeed } from '../../src/seed/seed';
import { Role } from '../../src/models/role.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
  await runSeed();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

async function permsOf(code: string): Promise<string[]> {
  const role = await Role.findOne({ code }).populate('permissions', 'code');
  return (role!.permissions as any[]).map((p) => p.code);
}

describe('product/metrics RBAC seed', () => {
  it('ADMIN has product:read, product:manage and metrics:read', async () => {
    const perms = await permsOf('ADMIN');
    expect(perms).toEqual(expect.arrayContaining(['product:read', 'product:manage', 'metrics:read']));
  });
  it('SALES has product:read but not product:manage', async () => {
    const perms = await permsOf('SALES');
    expect(perms).toContain('product:read');
    expect(perms).not.toContain('product:manage');
  });
  it('BORROWER has no product permissions', async () => {
    const perms = await permsOf('BORROWER');
    expect(perms).not.toContain('product:read');
    expect(perms).not.toContain('product:manage');
  });
});
