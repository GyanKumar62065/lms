// Side-effect barrel that registers EVERY Mongoose model with the connection.
// Importing this once at app startup guarantees models referenced only via
// populate() string refs (e.g. Role.permissions -> 'Permission') are registered
// in the server process — not just in processes that happen to import the seeder.
export * from './permission.model';
export * from './role.model';
export * from './user.model';
export * from './borrower-profile.model';
export * from './loan.model';
export * from './loan-product.model';
export * from './payment.model';
export * from './refresh-token.model';
export * from './counter.model';
export * from './captcha.model';
export * from './event.model';
