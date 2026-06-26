import mongoose from 'mongoose';
import { createApp } from '../../src/app';

// Jest gives each test file its own module registry, so only what THIS file's
// import graph pulls in is registered. Importing createApp must transitively
// register every model (via app.ts's `import './models'`) — otherwise populate()
// of string-ref'd models (e.g. Role.permissions -> 'Permission') 500s in the
// real server process. This guards against that regression.
describe('model registration at app load', () => {
  it('registers all models through the app import graph', () => {
    createApp();
    const names = mongoose.modelNames();
    for (const m of [
      'Permission',
      'Role',
      'User',
      'BorrowerProfile',
      'Loan',
      'Payment',
      'RefreshToken',
      'Counter',
    ]) {
      expect(names).toContain(m);
    }
  });
});
