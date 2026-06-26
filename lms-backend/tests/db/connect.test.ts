import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';

describe('connectDb', () => {
  let mem: MongoMemoryServer;
  beforeAll(async () => {
    mem = await MongoMemoryServer.create();
  });
  afterAll(async () => {
    await disconnectDb();
    await mem.stop();
  });
  it('connects and reports ready state 1', async () => {
    const m = await connectDb(mem.getUri());
    expect(m.connection.readyState).toBe(1);
  });
});
