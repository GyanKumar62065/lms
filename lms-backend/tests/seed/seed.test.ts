import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { runSeed } from '../../src/seed/seed';
import { Permission } from '../../src/models/permission.model';
import { Role } from '../../src/models/role.model';
import { User } from '../../src/models/user.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  // Ensure indexes are built before running seed to avoid unique-index race conditions
  await Permission.init();
  await Role.init();
  await User.init();
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('runSeed', () => {
  it('is idempotent and wires roles to permissions and users to roles', async () => {
    await runSeed();
    await runSeed(); // second run must not duplicate
    expect(await User.countDocuments({})).toBe(6); // one per role
    const sanction = await Role.findOne({ code: 'SANCTION' }).populate('permissions');
    const codes = (sanction!.permissions as any[]).map((p) => p.code);
    expect(codes).toEqual(expect.arrayContaining(['loan:sanction', 'loan:read:all']));
    expect(await Permission.countDocuments({ code: 'loan:sanction' })).toBe(1);
    const admin = await User.findOne({ email: 'admin@lms.test' });
    expect(admin).not.toBeNull();
  });

  it('grants loan:cancel to BORROWER and ADMIN only', async () => {
    const perms = await Permission.find({ code: 'loan:cancel' });
    expect(perms).toHaveLength(1);
    const borrower = await Role.findOne({ code: 'BORROWER' }).populate('permissions');
    const admin = await Role.findOne({ code: 'ADMIN' }).populate('permissions');
    const sales = await Role.findOne({ code: 'SALES' }).populate('permissions');
    const has = (r: any) => (r.permissions as any[]).some((p) => p.code === 'loan:cancel');
    expect(has(borrower)).toBe(true);
    expect(has(admin)).toBe(true);
    expect(has(sales)).toBe(false);
  });
});
