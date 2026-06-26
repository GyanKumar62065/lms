import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { User } from '../../src/models/user.model';
import { Role } from '../../src/models/role.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  await Promise.all([User.init(), Role.init()]);
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('User v2 fields', () => {
  it('stores firstName/lastName/phone and enforces unique phone', async () => {
    const role = await Role.create({ code: 'BORROWER', name: 'Borrower', description: 'b', permissions: [], isSystem: true });
    await User.create({ fullName: 'A B', firstName: 'A', lastName: 'B', phone: '9876543210', email: 'a@x.com', passwordHash: 'h', role: role._id });
    await expect(
      User.create({ fullName: 'C D', firstName: 'C', lastName: 'D', phone: '9876543210', email: 'c@x.com', passwordHash: 'h', role: role._id }),
    ).rejects.toThrow();
  });
  it('allows multiple users without a phone (sparse)', async () => {
    const role = await Role.findOne({ code: 'BORROWER' });
    await User.create({ fullName: 'No Phone1', email: 'np1@x.com', passwordHash: 'h', role: role!._id });
    await User.create({ fullName: 'No Phone2', email: 'np2@x.com', passwordHash: 'h', role: role!._id });
  });
});
