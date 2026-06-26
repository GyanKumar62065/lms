import { connectDb, disconnectDb } from '../db/connect';
import { Permission } from '../models/permission.model';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';
import { hashPassword } from '../lib/password';
import { logger } from '../lib/logger';
import { PERMISSIONS } from './definitions/permissions';
import { ROLES } from './definitions/roles';
import { SEED_USERS } from './definitions/users';
import { SEED_PRODUCTS, productSeedToPaise } from './definitions/products';
import { LoanProduct } from '../models/loan-product.model';

export async function runSeed(): Promise<void> {
  // 1. Permissions (upsert by code)
  for (const p of PERMISSIONS) {
    await Permission.updateOne({ code: p.code }, { $set: p }, { upsert: true });
  }
  const permByCode = new Map((await Permission.find()).map((p) => [p.code, p._id]));

  // 2. Roles (upsert by code, resolve permission ids)
  for (const r of ROLES) {
    const permissionIds = r.permissions.map((c) => {
      const id = permByCode.get(c);
      if (!id) throw new Error(`Unknown permission in role ${r.code}: ${c}`);
      return id;
    });
    await Role.updateOne(
      { code: r.code },
      { $set: { name: r.name, description: r.description, permissions: permissionIds, isSystem: true } },
      { upsert: true },
    );
  }
  const roleByCode = new Map((await Role.find()).map((r) => [r.code, r._id]));

  // 3. Users (upsert by email; only set password on insert)
  for (const u of SEED_USERS) {
    const roleId = roleByCode.get(u.roleCode);
    if (!roleId) throw new Error(`Unknown role for user ${u.email}: ${u.roleCode}`);
    const existing = await User.findOne({ email: u.email.toLowerCase() });
    if (existing) {
      await User.updateOne({ _id: existing._id }, { $set: { fullName: u.fullName, role: roleId, status: 'active' } });
    } else {
      await User.create({
        fullName: u.fullName,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        role: roleId,
        status: 'active',
      });
    }
  }
  // 4. Loan products (insert-if-absent by code; never overwrite admin edits)
  for (const p of SEED_PRODUCTS) {
    const exists = await LoanProduct.findOne({ code: p.code });
    if (!exists) await LoanProduct.create(productSeedToPaise(p));
  }

  logger.info('Seed complete');
}

if (require.main === module) {
  (async () => {
    try {
      await connectDb();
      await runSeed();
      await disconnectDb();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Seed failed');
      await disconnectDb();
      process.exit(1);
    }
  })();
}
