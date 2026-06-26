import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { Permission } from '../../src/models/permission.model';
import { Role } from '../../src/models/role.model';
import { User } from '../../src/models/user.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  // ensure unique indexes (permission.code, user.email) are built before assertions
  await Promise.all([Permission.init(), Role.init(), User.init()]);
});
afterAll(async () => {
  await disconnectDb();
  await mem.stop();
});

describe('RBAC models', () => {
  it('enforces unique permission code', async () => {
    await Permission.create({ code: 'lead:read', description: 'x', module: 'sales' });
    await expect(
      Permission.create({ code: 'lead:read', description: 'y', module: 'sales' }),
    ).rejects.toThrow();
  });
  it('links role -> permissions and user -> role', async () => {
    const p = await Permission.create({ code: 'loan:apply', description: 'apply', module: 'borrower' });
    const role = await Role.create({ code: 'BORROWER', name: 'Borrower', description: 'b', permissions: [p._id], isSystem: true });
    const u = await User.create({ fullName: 'Rahul', email: 'R@x.com', passwordHash: 'h', role: role._id });
    expect(u.email).toBe('r@x.com'); // lowercased
    const populated = await User.findById(u._id).populate({ path: 'role', populate: 'permissions' });
    expect((populated as any).role.permissions[0].code).toBe('loan:apply');
  });
});
