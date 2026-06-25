# Product v3 — Part A (Loan Products) BACKEND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-managed loan products to the backend: a `LoanProduct` catalog with per-product interest rate, principal/tenure bounds, and eligibility, plus product-scoped loan application (terms snapshotted onto the loan).

**Architecture:** A new `LoanProduct` Mongoose model + a `products` module (DTO, serializer, service, controller, routes) exposing public/authed/admin endpoints. `loan-math` and `bre` gain optional params (defaulting to today's globals) so existing callers are untouched. `applyForLoan` is rewritten to validate against a chosen product and snapshot its terms. RBAC seed gains three permissions; the seed gains a starter catalog.

**Tech Stack:** Express 4, Mongoose 8, MongoDB 7 (replica set), zod 3, Jest + ts-jest + supertest + mongodb-memory-server (ReplSet), Bun tooling.

## Global Constraints

- **Money:** integer **paise** in DB and all internal math. APIs accept/return **rupees** at the edge and convert via `rupeesToPaise`/`paiseToRupees` (`src/lib/money.ts`). Product bounds stored as paise; product DTOs accept rupees.
- **Tooling:** **Bun** everywhere. Tests via `bun run test` (NEVER `bun test`). Node 20 must be on PATH (`export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"`) — default node breaks Jest.
- **Models barrel:** every model is registered in `src/models/index.ts`; `import './models'` stays in `app.ts`. Any new model MUST be added to the barrel.
- **RBAC pattern unchanged:** permissions seeded in `src/seed/definitions/permissions.ts`, roles in `roles.ts`; routes gated by `authorize('<perm>')`.
- **Backwards compatibility:** existing v1/v2 endpoints and tests keep working. `GET /public/config` is retained. Existing loans without a product stay valid (`product` is required only for *new* applications — enforced in `applyForLoan`, not the schema).
- **Loan ref format** unchanged: `LMS-<year>-<6-digit-seq>`.
- **Run tests in band:** the suite uses `jest --runInBand`; each integration suite spins its own `MongoMemoryReplSet` and calls `runSeed()`.

> **Every test command in this plan must be prefixed with the Node-20 PATH export.** For brevity each command is written as `bun run test <path>` — run it as:
> `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH" && bun run test <path>`

---

### Task 1: New product error classes

**Files:**
- Modify: `src/lib/errors.ts`
- Test: `tests/lib/product-errors.test.ts`

**Interfaces:**
- Produces: `ProductNotFoundError` (404 `PRODUCT_NOT_FOUND`), `ProductBoundsError(message, details)` (422 `PRODUCT_BOUNDS`), `ProductEligibilityError(failedRules)` (422 `PRODUCT_ELIGIBILITY_FAILED`, `details: { failedRules }`), `ProductCodeExistsError` (409 `PRODUCT_CODE_EXISTS`). All extend `AppError`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/product-errors.test.ts`:

```ts
import {
  ProductNotFoundError,
  ProductBoundsError,
  ProductEligibilityError,
  ProductCodeExistsError,
  AppError,
} from '../../src/lib/errors';

describe('product errors', () => {
  it('ProductNotFoundError is a 404 with PRODUCT_NOT_FOUND', () => {
    const e = new ProductNotFoundError();
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('PRODUCT_NOT_FOUND');
  });
  it('ProductBoundsError is a 422 carrying details', () => {
    const e = new ProductBoundsError('out of range', { minPrincipal: 50000, maxPrincipal: 500000 });
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('PRODUCT_BOUNDS');
    expect(e.details).toEqual({ minPrincipal: 50000, maxPrincipal: 500000 });
  });
  it('ProductEligibilityError is a 422 carrying failedRules', () => {
    const e = new ProductEligibilityError(['AGE', 'SALARY']);
    expect(e.statusCode).toBe(422);
    expect(e.code).toBe('PRODUCT_ELIGIBILITY_FAILED');
    expect(e.details).toEqual({ failedRules: ['AGE', 'SALARY'] });
  });
  it('ProductCodeExistsError is a 409 with PRODUCT_CODE_EXISTS', () => {
    const e = new ProductCodeExistsError();
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('PRODUCT_CODE_EXISTS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/lib/product-errors.test.ts`
Expected: FAIL — `ProductNotFoundError` is not exported.

- [ ] **Step 3: Implement the error classes**

Append to `src/lib/errors.ts` (after `CaptchaError`):

```ts
export class ProductNotFoundError extends AppError {
  constructor(message = 'Loan product not found') { super(404, 'PRODUCT_NOT_FOUND', message); }
}
export class ProductBoundsError extends AppError {
  constructor(message: string, details?: unknown) { super(422, 'PRODUCT_BOUNDS', message, details); }
}
export class ProductEligibilityError extends AppError {
  constructor(failedRules: string[]) {
    super(422, 'PRODUCT_ELIGIBILITY_FAILED', 'Eligibility check failed for this product', { failedRules });
  }
}
export class ProductCodeExistsError extends AppError {
  constructor(message = 'A product with this code already exists') { super(409, 'PRODUCT_CODE_EXISTS', message); }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/lib/product-errors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts tests/lib/product-errors.test.ts
git commit -m "feat(errors): add loan-product error classes"
```

---

### Task 2: `LoanProduct` model

**Files:**
- Create: `src/models/loan-product.model.ts`
- Modify: `src/models/index.ts`
- Test: `tests/models/loan-product.model.test.ts`

**Interfaces:**
- Produces: `LoanProduct` (Mongoose model) and `ILoanProduct` type. Fields: `code: string` (unique, uppercase), `name`, `description`, `interestRate: number`, `minPrincipal`/`maxPrincipal: number` (paise), `minTenureDays`/`maxTenureDays: number`, `eligibility: { minAge, maxAge, minMonthlySalary (paise), employmentModes: string[] }`, `status: 'ACTIVE' | 'INACTIVE'` (default `'ACTIVE'`), timestamps.

- [ ] **Step 1: Write the failing test**

Create `tests/models/loan-product.model.test.ts`:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LoanProduct } from '../../src/models/loan-product.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('LoanProduct model', () => {
  it('persists a product with defaults and an uppercase-indexed code', async () => {
    const p = await LoanProduct.create({
      code: 'PERSONAL',
      name: 'Personal Loan',
      description: 'A personal loan',
      interestRate: 12,
      minPrincipal: 5_000_000,
      maxPrincipal: 50_000_000,
      minTenureDays: 30,
      maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 2_500_000, employmentModes: ['Salaried'] },
    });
    expect(p.status).toBe('ACTIVE');
    expect(p.minPrincipal).toBe(5_000_000);
    expect(p.eligibility.employmentModes).toEqual(['Salaried']);
  });
  it('rejects a duplicate code', async () => {
    await LoanProduct.create({
      code: 'DUP', name: 'A', description: 'd', interestRate: 10,
      minPrincipal: 1000, maxPrincipal: 2000, minTenureDays: 7, maxTenureDays: 30,
      eligibility: { minAge: 21, maxAge: 60, minMonthlySalary: 1000, employmentModes: ['Salaried'] },
    });
    await expect(
      LoanProduct.create({
        code: 'DUP', name: 'B', description: 'd', interestRate: 10,
        minPrincipal: 1000, maxPrincipal: 2000, minTenureDays: 7, maxTenureDays: 30,
        eligibility: { minAge: 21, maxAge: 60, minMonthlySalary: 1000, employmentModes: ['Salaried'] },
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/models/loan-product.model.test.ts`
Expected: FAIL — cannot find module `loan-product.model`.

- [ ] **Step 3: Create the model**

Create `src/models/loan-product.model.ts`:

```ts
import { Schema, model, InferSchemaType, Types } from 'mongoose';

const eligibilitySchema = new Schema(
  {
    minAge: { type: Number, required: true },
    maxAge: { type: Number, required: true },
    minMonthlySalary: { type: Number, required: true }, // paise
    employmentModes: { type: [String], required: true },
  },
  { _id: false },
);

const loanProductSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    interestRate: { type: Number, required: true }, // % p.a.
    minPrincipal: { type: Number, required: true }, // paise
    maxPrincipal: { type: Number, required: true }, // paise
    minTenureDays: { type: Number, required: true },
    maxTenureDays: { type: Number, required: true },
    eligibility: { type: eligibilitySchema, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

export type ILoanProduct = InferSchemaType<typeof loanProductSchema> & { _id: Types.ObjectId };
export const LoanProduct = model('LoanProduct', loanProductSchema);
```

- [ ] **Step 4: Register in the barrel**

Add to `src/models/index.ts` (after the `loan.model` line):

```ts
export * from './loan-product.model';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/models/loan-product.model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/models/loan-product.model.ts src/models/index.ts tests/models/loan-product.model.test.ts
git commit -m "feat(model): add LoanProduct model + register in barrel"
```

---

### Task 3: Parameterize `loan-math` with an optional rate

**Files:**
- Modify: `src/lib/loan-math.ts`
- Test: `tests/lib/loan-math.test.ts` (existing — add cases; do not remove existing)

**Interfaces:**
- Produces: `computeSimpleInterest(principalPaise, tenureDays, rate?: number)` and `computeRepayment(principalPaise, tenureDays, rate?: number)` — `rate` defaults to `INTEREST_RATE` (12). Existing two-arg callers unchanged.

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/loan-math.test.ts`:

```ts
import { computeSimpleInterest, computeRepayment, INTEREST_RATE } from '../../src/lib/loan-math';

describe('loan-math rate parameter', () => {
  it('defaults to INTEREST_RATE when rate is omitted', () => {
    expect(computeSimpleInterest(20_000_000, 60)).toBe(computeSimpleInterest(20_000_000, 60, INTEREST_RATE));
  });
  it('uses the provided rate', () => {
    // 20,000,000 paise * 18 * 60 / (365*100) = 591,780.8 -> round 591781
    expect(computeSimpleInterest(20_000_000, 60, 18)).toBe(591781);
  });
  it('computeRepayment honours the rate', () => {
    const r = computeRepayment(20_000_000, 60, 18);
    expect(r.simpleInterest).toBe(591781);
    expect(r.totalRepayment).toBe(20_000_000 + 591781);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/lib/loan-math.test.ts`
Expected: FAIL — `computeSimpleInterest(...,18)` ignores the 3rd arg and returns the 12% value.

- [ ] **Step 3: Implement the rate parameter**

Replace the two functions in `src/lib/loan-math.ts` (keep the `INTEREST_RATE` export):

```ts
export function computeSimpleInterest(principalPaise: number, tenureDays: number, rate: number = INTEREST_RATE): number {
  if (!Number.isInteger(principalPaise) || principalPaise <= 0) throw new Error('invalid principal');
  if (!Number.isInteger(tenureDays) || tenureDays <= 0) throw new Error('invalid tenure');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('invalid rate');
  return Math.round((principalPaise * rate * tenureDays) / (365 * 100));
}

export function computeRepayment(principalPaise: number, tenureDays: number, rate: number = INTEREST_RATE) {
  const simpleInterest = computeSimpleInterest(principalPaise, tenureDays, rate);
  return { principal: principalPaise, simpleInterest, totalRepayment: principalPaise + simpleInterest };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/lib/loan-math.test.ts`
Expected: PASS (existing cases + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loan-math.ts tests/lib/loan-math.test.ts
git commit -m "feat(loan-math): optional rate param (defaults to INTEREST_RATE)"
```

---

### Task 4: Parameterize `bre.evaluateBre` with optional thresholds

**Files:**
- Modify: `src/lib/bre.ts`
- Test: `tests/lib/bre.test.ts` (existing — add cases; do not remove existing)

**Interfaces:**
- Produces: `BreThresholds = { minAge: number; maxAge: number; minMonthlySalaryPaise: number; employmentModes?: EmploymentMode[] }` and `evaluateBre(input, thresholds?: BreThresholds)`. When `thresholds` omitted → today's global behavior. When `thresholds.employmentModes` provided → EMPLOYMENT fails if `employmentMode` not in the list; otherwise legacy `=== 'Unemployed'` rule applies.

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/bre.test.ts`:

```ts
import { evaluateBre, BreThresholds } from '../../src/lib/bre';

describe('evaluateBre product thresholds', () => {
  const base = { pan: 'ABCDE1234F', dob: new Date('1995-04-12'), monthlySalaryPaise: 2_000_000, employmentMode: 'Salaried' as const, asOf: new Date('2026-06-25') };

  it('uses global defaults when thresholds omitted (₹20k < ₹25k fails SALARY)', () => {
    expect(evaluateBre(base).failedRules).toContain('SALARY');
  });
  it('passes a looser product threshold (₹15k floor)', () => {
    const t: BreThresholds = { minAge: 21, maxAge: 55, minMonthlySalaryPaise: 1_500_000, employmentModes: ['Salaried'] };
    expect(evaluateBre(base, t)).toEqual({ passed: true, failedRules: [] });
  });
  it('fails EMPLOYMENT when mode not in the product allow-list', () => {
    const t: BreThresholds = { minAge: 21, maxAge: 55, minMonthlySalaryPaise: 1_500_000, employmentModes: ['Salaried'] };
    const res = evaluateBre({ ...base, employmentMode: 'Self-Employed' }, t);
    expect(res.failedRules).toContain('EMPLOYMENT');
  });
  it('fails AGE against a stricter product window', () => {
    const t: BreThresholds = { minAge: 40, maxAge: 50, minMonthlySalaryPaise: 1_000_000, employmentModes: ['Salaried'] };
    expect(evaluateBre(base, t).failedRules).toContain('AGE'); // borrower is 31 in 2026
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/lib/bre.test.ts`
Expected: FAIL — `BreThresholds` not exported / 2nd arg ignored.

- [ ] **Step 3: Implement the thresholds parameter**

In `src/lib/bre.ts`, add the type and rewrite `evaluateBre` (keep `computeAge`, `PAN_REGEX`, and the module-level `MIN_*` constants):

```ts
export type BreThresholds = {
  minAge: number;
  maxAge: number;
  minMonthlySalaryPaise: number;
  employmentModes?: EmploymentMode[];
};

const DEFAULT_THRESHOLDS: BreThresholds = {
  minAge: MIN_AGE,
  maxAge: MAX_AGE,
  minMonthlySalaryPaise: MIN_SALARY_PAISE,
  // employmentModes omitted -> legacy "fails only when Unemployed"
};

export function evaluateBre(
  input: { pan: string; dob: Date; monthlySalaryPaise: number; employmentMode: EmploymentMode; asOf?: Date },
  thresholds: BreThresholds = DEFAULT_THRESHOLDS,
): { passed: boolean; failedRules: BreRuleCode[] } {
  const asOf = input.asOf ?? new Date();
  const failed: BreRuleCode[] = [];
  const age = computeAge(input.dob, asOf);
  if (age < thresholds.minAge || age > thresholds.maxAge) failed.push('AGE');
  if (input.monthlySalaryPaise < thresholds.minMonthlySalaryPaise) failed.push('SALARY');
  if (!PAN_REGEX.test(input.pan)) failed.push('PAN');
  if (thresholds.employmentModes) {
    if (!thresholds.employmentModes.includes(input.employmentMode)) failed.push('EMPLOYMENT');
  } else if (input.employmentMode === 'Unemployed') {
    failed.push('EMPLOYMENT');
  }
  return { passed: failed.length === 0, failedRules: failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/lib/bre.test.ts`
Expected: PASS (existing cases + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bre.ts tests/lib/bre.test.ts
git commit -m "feat(bre): optional product thresholds (defaults to global rules)"
```

---

### Task 5: RBAC seed — product & metrics permissions

**Files:**
- Modify: `src/seed/definitions/permissions.ts`
- Modify: `src/seed/definitions/roles.ts`
- Test: `tests/seed/product-rbac.test.ts`

**Interfaces:**
- Produces: permission codes `product:read`, `product:manage`, `metrics:read`. ADMIN gains all three; SALES/SANCTION/DISBURSEMENT/COLLECTION gain `product:read`; BORROWER unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/seed/product-rbac.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/seed/product-rbac.test.ts`
Expected: FAIL — ADMIN lacks the new permissions.

- [ ] **Step 3: Add the permissions**

Add to the `PERMISSIONS` array in `src/seed/definitions/permissions.ts` (before the closing `]`):

```ts
  { code: 'product:read', description: 'View loan products (incl. inactive)', module: 'products' },
  { code: 'product:manage', description: 'Create/edit/activate loan products', module: 'products' },
  { code: 'metrics:read', description: 'View admin dashboard metrics', module: 'admin' },
```

- [ ] **Step 4: Map permissions to roles**

In `src/seed/definitions/roles.ts`, update the role `permissions` arrays:

```ts
export const ROLES = [
  {
    code: 'ADMIN',
    name: 'Admin',
    description: 'Full operational access',
    permissions: ['lead:read', 'loan:read:all', 'loan:sanction', 'loan:disburse', 'payment:create', 'payment:read', 'rbac:read', 'product:read', 'product:manage', 'metrics:read'],
  },
  { code: 'SALES', name: 'Sales', description: 'Lead tracking', permissions: ['lead:read', 'product:read'] },
  { code: 'SANCTION', name: 'Sanction', description: 'Approve/reject loans', permissions: ['loan:sanction', 'loan:read:all', 'payment:read', 'product:read'] },
  { code: 'DISBURSEMENT', name: 'Disbursement', description: 'Disburse funds', permissions: ['loan:disburse', 'loan:read:all', 'payment:read', 'product:read'] },
  { code: 'COLLECTION', name: 'Collection', description: 'Record payments', permissions: ['payment:create', 'payment:read', 'loan:read:all', 'product:read'] },
  { code: 'BORROWER', name: 'Borrower', description: 'Apply and track own loans', permissions: ['loan:apply', 'loan:read:own'] },
] as const;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/seed/product-rbac.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/seed/definitions/permissions.ts src/seed/definitions/roles.ts tests/seed/product-rbac.test.ts
git commit -m "feat(rbac): seed product:read, product:manage, metrics:read"
```

---

### Task 6: Seed the starter product catalog

**Files:**
- Create: `src/seed/definitions/products.ts`
- Modify: `src/seed/seed.ts`
- Test: `tests/seed/products.test.ts`

**Interfaces:**
- Consumes: `LoanProduct` model, `rupeesToPaise`.
- Produces: `SEED_PRODUCTS` array (rupee-denominated definitions). `runSeed()` upserts products by `code` (insert-if-absent — never overwrites an existing product's edited fields).

- [ ] **Step 1: Write the failing test**

Create `tests/seed/products.test.ts`:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { runSeed } from '../../src/seed/seed';
import { LoanProduct } from '../../src/models/loan-product.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('seed products', () => {
  it('inserts PERSONAL and SALARY_ADVANCE with paise bounds', async () => {
    await runSeed();
    const personal = await LoanProduct.findOne({ code: 'PERSONAL' });
    expect(personal).toBeTruthy();
    expect(personal!.interestRate).toBe(12);
    expect(personal!.minPrincipal).toBe(5_000_000); // ₹50,000
    expect(personal!.maxPrincipal).toBe(50_000_000); // ₹5,00,000
    expect(personal!.eligibility.minMonthlySalary).toBe(2_500_000); // ₹25,000
    const adv = await LoanProduct.findOne({ code: 'SALARY_ADVANCE' });
    expect(adv!.interestRate).toBe(18);
    expect(adv!.maxPrincipal).toBe(10_000_000); // ₹1,00,000
    expect(adv!.eligibility.employmentModes).toEqual(['Salaried']);
  });
  it('does not overwrite an edited product on re-seed', async () => {
    await LoanProduct.updateOne({ code: 'PERSONAL' }, { $set: { interestRate: 9 } });
    await runSeed();
    const personal = await LoanProduct.findOne({ code: 'PERSONAL' });
    expect(personal!.interestRate).toBe(9); // preserved, not reset to 12
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/seed/products.test.ts`
Expected: FAIL — products are not seeded.

- [ ] **Step 3: Create the seed definitions**

Create `src/seed/definitions/products.ts`:

```ts
import { rupeesToPaise } from '../../lib/money';

// rupee-denominated definitions; converted to paise at seed time
export const SEED_PRODUCTS = [
  {
    code: 'PERSONAL',
    name: 'Personal Loan',
    description: 'A flexible personal loan for salaried and self-employed applicants.',
    interestRate: 12,
    minPrincipal: 50_000,
    maxPrincipal: 5_00_000,
    minTenureDays: 30,
    maxTenureDays: 365,
    eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25_000, employmentModes: ['Salaried', 'Self-Employed'] },
  },
  {
    code: 'SALARY_ADVANCE',
    name: 'Salary Advance',
    description: 'A short-tenure advance against your salary.',
    interestRate: 18,
    minPrincipal: 10_000,
    maxPrincipal: 1_00_000,
    minTenureDays: 7,
    maxTenureDays: 60,
    eligibility: { minAge: 21, maxAge: 55, minMonthlySalary: 15_000, employmentModes: ['Salaried'] },
  },
] as const;

export function productSeedToPaise(p: (typeof SEED_PRODUCTS)[number]) {
  return {
    code: p.code,
    name: p.name,
    description: p.description,
    interestRate: p.interestRate,
    minPrincipal: rupeesToPaise(p.minPrincipal),
    maxPrincipal: rupeesToPaise(p.maxPrincipal),
    minTenureDays: p.minTenureDays,
    maxTenureDays: p.maxTenureDays,
    eligibility: {
      minAge: p.eligibility.minAge,
      maxAge: p.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(p.eligibility.minMonthlySalary),
      employmentModes: [...p.eligibility.employmentModes],
    },
    status: 'ACTIVE' as const,
  };
}
```

- [ ] **Step 4: Upsert products in `runSeed`**

In `src/seed/seed.ts`, add the import at the top with the other definition imports:

```ts
import { SEED_PRODUCTS, productSeedToPaise } from './definitions/products';
import { LoanProduct } from '../models/loan-product.model';
```

Then add a new step at the end of `runSeed()` (before `logger.info('Seed complete')`):

```ts
  // 4. Loan products (insert-if-absent by code; never overwrite admin edits)
  for (const p of SEED_PRODUCTS) {
    const exists = await LoanProduct.findOne({ code: p.code });
    if (!exists) await LoanProduct.create(productSeedToPaise(p));
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/seed/products.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/seed/definitions/products.ts src/seed/seed.ts tests/seed/products.test.ts
git commit -m "feat(seed): seed PERSONAL and SALARY_ADVANCE products (insert-if-absent)"
```

---

### Task 7: Product DTOs + serializer

**Files:**
- Create: `src/modules/products/product.dto.ts`
- Create: `src/modules/products/product.serializer.ts`
- Test: `tests/modules/products/product-dto.test.ts`

**Interfaces:**
- Produces:
  - `createProductDto` (zod) — accepts rupees, refines min≤max for principal/tenure/age and non-empty `employmentModes`; `code` transformed to uppercase.
  - `updateProductDto` — `createProductDto` without `code`, all-optional, same refines guarded for undefined.
  - `CreateProductInput`, `UpdateProductInput` types.
  - `serializeProduct(doc)` → rupee-denominated plain object: `{ id, code, name, description, interestRate, minPrincipal, maxPrincipal, minTenureDays, maxTenureDays, eligibility: { minAge, maxAge, minMonthlySalary, employmentModes }, status, createdAt, updatedAt }`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products/product-dto.test.ts`:

```ts
import { createProductDto, updateProductDto } from '../../../src/modules/products/product.dto';
import { serializeProduct } from '../../../src/modules/products/product.serializer';

const valid = {
  code: 'personal', name: 'Personal Loan', description: 'd', interestRate: 12,
  minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
};

describe('product DTOs', () => {
  it('accepts a valid product and uppercases the code', () => {
    const r = createProductDto.parse(valid);
    expect(r.code).toBe('PERSONAL');
  });
  it('rejects minPrincipal > maxPrincipal', () => {
    expect(() => createProductDto.parse({ ...valid, minPrincipal: 600000 })).toThrow();
  });
  it('rejects minAge > maxAge', () => {
    expect(() => createProductDto.parse({ ...valid, eligibility: { ...valid.eligibility, minAge: 60 } })).toThrow();
  });
  it('rejects empty employmentModes', () => {
    expect(() => createProductDto.parse({ ...valid, eligibility: { ...valid.eligibility, employmentModes: [] } })).toThrow();
  });
  it('update DTO allows a partial patch', () => {
    const r = updateProductDto.parse({ interestRate: 15 });
    expect(r.interestRate).toBe(15);
  });
  it('update DTO still rejects an inverted range when both present', () => {
    expect(() => updateProductDto.parse({ minPrincipal: 9, maxPrincipal: 1 })).toThrow();
  });
});

describe('serializeProduct', () => {
  it('converts paise to rupees', () => {
    const out = serializeProduct({
      _id: { toString: () => 'abc' }, code: 'PERSONAL', name: 'Personal Loan', description: 'd',
      interestRate: 12, minPrincipal: 5_000_000, maxPrincipal: 50_000_000, minTenureDays: 30, maxTenureDays: 365,
      eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 2_500_000, employmentModes: ['Salaried'] },
      status: 'ACTIVE', createdAt: new Date(0), updatedAt: new Date(0),
    } as any);
    expect(out.minPrincipal).toBe(50000);
    expect(out.maxPrincipal).toBe(500000);
    expect(out.eligibility.minMonthlySalary).toBe(25000);
    expect(out.id).toBe('abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/modules/products/product-dto.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create the DTO**

Create `src/modules/products/product.dto.ts`:

```ts
import { z } from 'zod';

const EMPLOYMENT_MODES = ['Salaried', 'Self-Employed', 'Unemployed'] as const;

const eligibilityShape = z.object({
  minAge: z.number().int().min(18).max(100),
  maxAge: z.number().int().min(18).max(100),
  minMonthlySalary: z.number().int().nonnegative(), // rupees
  employmentModes: z.array(z.enum(EMPLOYMENT_MODES)).min(1),
});

const baseShape = {
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'code must be alphanumeric/underscore').transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  interestRate: z.number().min(0).max(100),
  minPrincipal: z.number().int().positive(), // rupees
  maxPrincipal: z.number().int().positive(),
  minTenureDays: z.number().int().positive(),
  maxTenureDays: z.number().int().positive(),
  eligibility: eligibilityShape,
};

function applyRangeRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((d: any) => d.minPrincipal == null || d.maxPrincipal == null || d.minPrincipal <= d.maxPrincipal, {
      message: 'minPrincipal must be <= maxPrincipal', path: ['maxPrincipal'],
    })
    .refine((d: any) => d.minTenureDays == null || d.maxTenureDays == null || d.minTenureDays <= d.maxTenureDays, {
      message: 'minTenureDays must be <= maxTenureDays', path: ['maxTenureDays'],
    })
    .refine((d: any) => d.eligibility == null || d.eligibility.minAge <= d.eligibility.maxAge, {
      message: 'minAge must be <= maxAge', path: ['eligibility', 'maxAge'],
    });
}

export const createProductDto = applyRangeRefinements(z.object(baseShape));
export const updateProductDto = applyRangeRefinements(z.object(baseShape).omit({ code: true }).partial());

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
```

- [ ] **Step 4: Create the serializer**

Create `src/modules/products/product.serializer.ts`:

```ts
import { paiseToRupees } from '../../lib/money';
import { ILoanProduct } from '../../models/loan-product.model';

export function serializeProduct(p: ILoanProduct) {
  return {
    id: p._id.toString(),
    code: p.code,
    name: p.name,
    description: p.description,
    interestRate: p.interestRate,
    minPrincipal: paiseToRupees(p.minPrincipal),
    maxPrincipal: paiseToRupees(p.maxPrincipal),
    minTenureDays: p.minTenureDays,
    maxTenureDays: p.maxTenureDays,
    eligibility: {
      minAge: p.eligibility.minAge,
      maxAge: p.eligibility.maxAge,
      minMonthlySalary: paiseToRupees(p.eligibility.minMonthlySalary),
      employmentModes: p.eligibility.employmentModes,
    },
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/modules/products/product-dto.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/products/product.dto.ts src/modules/products/product.serializer.ts tests/modules/products/product-dto.test.ts
git commit -m "feat(products): product DTOs (rupees, range refinements) + serializer"
```

---

### Task 8: Products module — service, controller, routes (public + authed + admin)

**Files:**
- Create: `src/modules/products/product.service.ts`
- Create: `src/modules/products/product.controller.ts`
- Create: `src/modules/products/product.routes.ts`
- Modify: `src/routes.ts`
- Modify: `src/modules/public/public.routes.ts`
- Test: `tests/modules/products/products.int.test.ts`

**Interfaces:**
- Consumes: `LoanProduct`, `serializeProduct`, `createProductDto`/`updateProductDto`, `rupeesToPaise`, `ProductCodeExistsError`, `ProductNotFoundError`, `authenticate`, `authorize`, `validate`, `asyncHandler`.
- Produces:
  - service: `listProducts(includeInactive: boolean)`, `getProductByCode(code: string)`, `createProduct(input: CreateProductInput)`, `updateProduct(id: string, patch: UpdateProductInput)`, `setProductStatus(id: string, status: 'ACTIVE'|'INACTIVE')`.
  - routers: `productsRouter` (mounted at `/products`), `adminProductsRouter` (mounted at `/admin/products`), `listPublicProducts` controller (mounted on the public router at `/products`).

- [ ] **Step 1: Write the failing test**

Create `tests/modules/products/products.int.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/modules/products/products.int.test.ts`
Expected: FAIL — routes return 404 (not wired).

- [ ] **Step 3: Create the service**

Create `src/modules/products/product.service.ts`:

```ts
import { Types } from 'mongoose';
import { LoanProduct } from '../../models/loan-product.model';
import { rupeesToPaise } from '../../lib/money';
import { ProductCodeExistsError, ProductNotFoundError } from '../../lib/errors';
import { CreateProductInput, UpdateProductInput } from './product.dto';

export async function listProducts(includeInactive: boolean) {
  const filter = includeInactive ? {} : { status: 'ACTIVE' };
  return LoanProduct.find(filter).sort({ name: 1 });
}

export async function getProductByCode(code: string) {
  const product = await LoanProduct.findOne({ code: code.toUpperCase() });
  if (!product) throw new ProductNotFoundError();
  return product;
}

function toPaiseDoc(input: CreateProductInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    interestRate: input.interestRate,
    minPrincipal: rupeesToPaise(input.minPrincipal),
    maxPrincipal: rupeesToPaise(input.maxPrincipal),
    minTenureDays: input.minTenureDays,
    maxTenureDays: input.maxTenureDays,
    eligibility: {
      minAge: input.eligibility.minAge,
      maxAge: input.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(input.eligibility.minMonthlySalary),
      employmentModes: input.eligibility.employmentModes,
    },
    status: 'ACTIVE' as const,
  };
}

export async function createProduct(input: CreateProductInput) {
  const existing = await LoanProduct.findOne({ code: input.code });
  if (existing) throw new ProductCodeExistsError();
  try {
    return await LoanProduct.create(toPaiseDoc(input));
  } catch (err: any) {
    if (err?.code === 11000) throw new ProductCodeExistsError();
    throw err;
  }
}

export async function updateProduct(id: string, patch: UpdateProductInput) {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError();
  const set: Record<string, unknown> = {};
  if (patch.name != null) set.name = patch.name;
  if (patch.description != null) set.description = patch.description;
  if (patch.interestRate != null) set.interestRate = patch.interestRate;
  if (patch.minPrincipal != null) set.minPrincipal = rupeesToPaise(patch.minPrincipal);
  if (patch.maxPrincipal != null) set.maxPrincipal = rupeesToPaise(patch.maxPrincipal);
  if (patch.minTenureDays != null) set.minTenureDays = patch.minTenureDays;
  if (patch.maxTenureDays != null) set.maxTenureDays = patch.maxTenureDays;
  if (patch.eligibility != null) {
    set.eligibility = {
      minAge: patch.eligibility.minAge,
      maxAge: patch.eligibility.maxAge,
      minMonthlySalary: rupeesToPaise(patch.eligibility.minMonthlySalary),
      employmentModes: patch.eligibility.employmentModes,
    };
  }
  const product = await LoanProduct.findByIdAndUpdate(id, { $set: set }, { new: true });
  if (!product) throw new ProductNotFoundError();
  return product;
}

export async function setProductStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError();
  const product = await LoanProduct.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!product) throw new ProductNotFoundError();
  return product;
}
```

> Note: `updateProduct`'s `eligibility` is treated as a whole-object replace (the DTO's `eligibility` is required-shape when present). Partial-eligibility edits are out of scope for v3.

- [ ] **Step 4: Create the controller**

Create `src/modules/products/product.controller.ts`:

```ts
import { Request, Response } from 'express';
import * as service from './product.service';
import { serializeProduct } from './product.serializer';

export async function listPublicProducts(_req: Request, res: Response) {
  const products = await service.listProducts(false);
  res.json({ data: products.map(serializeProduct) });
}
export async function listProducts(_req: Request, res: Response) {
  const products = await service.listProducts(true);
  res.json({ data: products.map(serializeProduct) });
}
export async function getProduct(req: Request, res: Response) {
  const product = await service.getProductByCode(req.params.code);
  res.json(serializeProduct(product));
}
export async function createProduct(req: Request, res: Response) {
  const product = await service.createProduct(req.body);
  res.status(201).json(serializeProduct(product));
}
export async function updateProduct(req: Request, res: Response) {
  const product = await service.updateProduct(req.params.id, req.body);
  res.json(serializeProduct(product));
}
export async function activateProduct(req: Request, res: Response) {
  const product = await service.setProductStatus(req.params.id, 'ACTIVE');
  res.json(serializeProduct(product));
}
export async function deactivateProduct(req: Request, res: Response) {
  const product = await service.setProductStatus(req.params.id, 'INACTIVE');
  res.json(serializeProduct(product));
}
```

- [ ] **Step 5: Create the routers**

Create `src/modules/products/product.routes.ts`:

```ts
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { createProductDto, updateProductDto } from './product.dto';
import * as c from './product.controller';

// authed read (ops + admin): /api/v1/products
export const productsRouter = Router();
productsRouter.use(authenticate, authorize('product:read'));
productsRouter.get('/', asyncHandler(c.listProducts));
productsRouter.get('/:code', asyncHandler(c.getProduct));

// admin write: /api/v1/admin/products
export const adminProductsRouter = Router();
adminProductsRouter.use(authenticate, authorize('product:manage'));
adminProductsRouter.post('/', validate({ body: createProductDto }), asyncHandler(c.createProduct));
adminProductsRouter.patch('/:id', validate({ body: updateProductDto }), asyncHandler(c.updateProduct));
adminProductsRouter.post('/:id/activate', asyncHandler(c.activateProduct));
adminProductsRouter.post('/:id/deactivate', asyncHandler(c.deactivateProduct));
```

- [ ] **Step 6: Wire the routers**

In `src/routes.ts`, add after the rbac router mount:

```ts
import { productsRouter, adminProductsRouter } from './modules/products/product.routes';
apiRouter.use('/products', productsRouter);
apiRouter.use('/admin/products', adminProductsRouter);
```

In `src/modules/public/public.routes.ts`, add the public products route:

```ts
import { listPublicProducts } from '../products/product.controller';
publicRouter.get('/products', listPublicProducts);
```

(Keep the existing `publicRouter.get('/config', ...)` line.)

- [ ] **Step 7: Run test to verify it passes**

Run: `bun run test tests/modules/products/products.int.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 8: Commit**

```bash
git add src/modules/products/ src/routes.ts src/modules/public/public.routes.ts tests/modules/products/products.int.test.ts
git commit -m "feat(products): public/authed/admin product endpoints + RBAC"
```

---

### Task 9: Loan term-snapshot fields

**Files:**
- Modify: `src/models/loan.model.ts`
- Test: `tests/models/loan-product-snapshot.test.ts`

**Interfaces:**
- Produces: `Loan` schema gains `product?: ObjectId (ref 'LoanProduct')`, `productCode?: string`, `productName?: string`. All optional in the schema (legacy loans stay valid); `applyForLoan` (Task 10) sets them on every new loan.

- [ ] **Step 1: Write the failing test**

Create `tests/models/loan-product-snapshot.test.ts`:

```ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Loan } from '../../src/models/loan.model';

let mem: MongoMemoryServer;
beforeAll(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('Loan product snapshot fields', () => {
  it('stores product ref + denormalized code/name', async () => {
    const productId = new mongoose.Types.ObjectId();
    const loan = await Loan.create({
      loanRef: 'LMS-2026-000999', borrower: new mongoose.Types.ObjectId(),
      principal: 20_000_000, tenureDays: 60, interestRate: 18, simpleInterest: 591781,
      totalRepayment: 20_591_781, amountPaid: 0, outstanding: 20_591_781, status: 'APPLIED',
      salarySlip: { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 },
      product: productId, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance',
      statusHistory: [{ from: null, to: 'APPLIED', at: new Date() }],
    });
    expect(loan.product?.toString()).toBe(productId.toString());
    expect(loan.productCode).toBe('SALARY_ADVANCE');
    expect(loan.productName).toBe('Salary Advance');
  });
  it('still allows a legacy loan with no product', async () => {
    const loan = await Loan.create({
      loanRef: 'LMS-2026-000998', borrower: new mongoose.Types.ObjectId(),
      principal: 20_000_000, tenureDays: 60, interestRate: 12, simpleInterest: 394521,
      totalRepayment: 20_394_521, amountPaid: 0, outstanding: 20_394_521, status: 'APPLIED',
      salarySlip: { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 },
      statusHistory: [{ from: null, to: 'APPLIED', at: new Date() }],
    });
    expect(loan.product).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/models/loan-product-snapshot.test.ts`
Expected: FAIL — `loan.productCode` is undefined (field not in schema, stripped on save).

- [ ] **Step 3: Add the fields**

In `src/models/loan.model.ts`, add to `loanSchema` (after the `borrower` field):

```ts
    product: { type: Schema.Types.ObjectId, ref: 'LoanProduct' },
    productCode: { type: String },
    productName: { type: String },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/models/loan-product-snapshot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/loan.model.ts tests/models/loan-product-snapshot.test.ts
git commit -m "feat(loan): add product ref + denormalized code/name snapshot fields"
```

---

### Task 10: Product-scoped `applyForLoan` + shared apply helper + suite migration

**Files:**
- Modify: `src/modules/borrower/borrower.dto.ts`
- Modify: `src/modules/borrower/borrower.service.ts`
- Create: `tests/helpers/apply-loan.ts`
- Modify: `tests/modules/borrower/apply.int.test.ts`
- Modify: `tests/modules/borrower/active-application.int.test.ts`
- Modify: `tests/modules/loans/transitions.int.test.ts`
- Modify: `tests/modules/payments/payments.int.test.ts`
- Create: `tests/modules/borrower/apply-product.int.test.ts`

**Interfaces:**
- Consumes: `LoanProduct`, `evaluateBre` (with thresholds), `computeRepayment` (with rate), `ProductNotFoundError`, `ProductBoundsError`, `ProductEligibilityError`, `ConflictError`.
- Produces:
  - `applyDto` gains `productCode: z.string().min(1)` (uppercased); principal/tenure outer guards widened to `principal 1000..1000000` rupees, `tenureDays 1..365`.
  - `applyForLoan(userId, { productCode: string; principal: number; tenureDays: number })`.
  - test helper `applyLoan(agent, over?: { productCode?; principal?; tenureDays? })` → POSTs `/api/v1/borrower/loans` with defaults `{ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 }`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/borrower/apply-product.int.test.ts`:

```ts
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';
import { applyLoan } from '../../helpers/apply-loan';
import { LoanProduct } from '../../../src/models/loan-product.model';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/u'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/d'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function readyBorrower(over: Record<string, unknown> = {}) {
  const agent = request.agent(app);
  await signupBorrower(agent);
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'B', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried', ...over });
  await stageSlip(agent);
  return agent;
}
async function stageSlip(agent: any) {
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
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

describe('apply against a product', () => {
  it('404 when the product code is unknown/inactive', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'NOPE' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('422 PRODUCT_BOUNDS when principal is outside the product range', async () => {
    const agent = await readyBorrower();
    // SALARY_ADVANCE max is ₹1,00,000; ask for ₹2,00,000
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 200000, tenureDays: 30 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_BOUNDS');
    expect(res.body.error.details.maxPrincipal).toBe(100000); // rupees
  });

  it('422 PRODUCT_ELIGIBILITY_FAILED when profile fails the product rule', async () => {
    // Self-Employed passes PERSONAL but fails SALARY_ADVANCE (Salaried only)
    const agent = await readyBorrower({ employmentMode: 'Self-Employed' });
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_ELIGIBILITY_FAILED');
    expect(res.body.error.details.failedRules).toContain('EMPLOYMENT');
  });

  it('snapshots the product rate/code/name onto the loan', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(201);
    expect(res.body.productCode).toBe('SALARY_ADVANCE');
    expect(res.body.productName).toBe('Salary Advance');
    expect(res.body.interestRate).toBe(18);
    // 5,000,000 paise * 18 * 30 / (365*100) = 73,972.6 -> 73973
    expect(res.body.simpleInterest).toBe(73973);
  });

  it('allows one active loan PER product (different products OK)', async () => {
    const agent = await readyBorrower();
    const first = await applyLoan(agent, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    await stageSlip(agent);
    const second = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(second.status).toBe(201);
  });

  it('blocks a second active loan for the SAME product (409)', async () => {
    const agent = await readyBorrower();
    const first = await applyLoan(agent, { productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    await stageSlip(agent);
    const dup = await applyLoan(agent, { productCode: 'PERSONAL', principal: 100000, tenureDays: 90 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    expect(dup.body.error.details.productCode).toBe('PERSONAL');
  });

  it('snapshot is immutable: editing the product rate does not change an existing loan', async () => {
    const agent = await readyBorrower();
    const res = await applyLoan(agent, { productCode: 'SALARY_ADVANCE', principal: 50000, tenureDays: 30 });
    expect(res.status).toBe(201);
    await LoanProduct.updateOne({ code: 'SALARY_ADVANCE' }, { $set: { interestRate: 25 } });
    const after = await agent.get(`/api/v1/borrower/loans/${res.body._id}`);
    expect(after.body.interestRate).toBe(18); // unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/modules/borrower/apply-product.int.test.ts`
Expected: FAIL — `apply-loan` helper missing and `applyForLoan` ignores `productCode`.

- [ ] **Step 3: Create the shared apply helper**

Create `tests/helpers/apply-loan.ts`:

```ts
// Centralized apply call so the product-scoped body lives in ONE place
// (mirrors the v2 signupBorrower cascade lesson).
export function applyLoan(
  agent: any,
  over: { productCode?: string; principal?: number; tenureDays?: number } = {},
) {
  return agent.post('/api/v1/borrower/loans').send({
    productCode: 'PERSONAL',
    principal: 200000,
    tenureDays: 60,
    ...over,
  });
}
```

- [ ] **Step 4: Update the apply DTO**

In `src/modules/borrower/borrower.dto.ts`, replace `applyDto`:

```ts
export const applyDto = z.object({
  productCode: z.string().trim().min(1).transform((s) => s.toUpperCase()),
  principal: z.number().int().min(1000).max(1_000_000), // rupees — outer guard; real bounds per product
  tenureDays: z.number().int().min(1).max(365),
});
export type ApplyInput = z.infer<typeof applyDto>;
```

- [ ] **Step 5: Rewrite `applyForLoan`**

In `src/modules/borrower/borrower.service.ts`:

Update the imports block:

```ts
import { evaluateBre, EmploymentMode } from '../../lib/bre';
import { rupeesToPaise, paiseToRupees } from '../../lib/money';
import { computeRepayment } from '../../lib/loan-math';
import { generateLoanRef } from '../../lib/loan-ref';
import { ValidationError, NotFoundError, ConflictError, ProductNotFoundError, ProductBoundsError, ProductEligibilityError } from '../../lib/errors';
import { LoanProduct } from '../../models/loan-product.model';
```

Replace the entire `applyForLoan` function:

```ts
export async function applyForLoan(
  userId: string,
  input: { productCode: string; principal: number; tenureDays: number },
) {
  const principal = rupeesToPaise(input.principal);

  const session = await mongoose.startSession();
  try {
    let createdLoan: any;
    await session.withTransaction(async () => {
      // 1. product must exist and be ACTIVE
      const product = await LoanProduct.findOne({ code: input.productCode, status: 'ACTIVE' }).session(session);
      if (!product) throw new ProductNotFoundError();

      // 2. bounds (paise) against the product
      if (principal < product.minPrincipal || principal > product.maxPrincipal) {
        throw new ProductBoundsError('Principal is outside the product range', {
          minPrincipal: paiseToRupees(product.minPrincipal),
          maxPrincipal: paiseToRupees(product.maxPrincipal),
          minTenureDays: product.minTenureDays,
          maxTenureDays: product.maxTenureDays,
        });
      }
      if (input.tenureDays < product.minTenureDays || input.tenureDays > product.maxTenureDays) {
        throw new ProductBoundsError('Tenure is outside the product range', {
          minPrincipal: paiseToRupees(product.minPrincipal),
          maxPrincipal: paiseToRupees(product.maxPrincipal),
          minTenureDays: product.minTenureDays,
          maxTenureDays: product.maxTenureDays,
        });
      }

      // 3. profile + staged slip
      const profile = await BorrowerProfile.findOne({ user: new Types.ObjectId(userId) }).session(session);
      if (!profile) throw new ConflictError('Complete your profile first');
      if (!profile.pendingSalarySlip) throw new ConflictError('Salary slip not uploaded');

      // 4. product-specific eligibility
      const bre = evaluateBre(
        {
          pan: profile.pan,
          dob: profile.dob,
          monthlySalaryPaise: profile.monthlySalary,
          employmentMode: profile.employmentMode as EmploymentMode,
        },
        {
          minAge: product.eligibility.minAge,
          maxAge: product.eligibility.maxAge,
          minMonthlySalaryPaise: product.eligibility.minMonthlySalary,
          employmentModes: product.eligibility.employmentModes as EmploymentMode[],
        },
      );
      if (!bre.passed) throw new ProductEligibilityError(bre.failedRules);

      // 5. per-product one-active guard
      const active = await Loan.findOne(
        { borrower: new Types.ObjectId(userId), product: product._id, status: { $in: ['APPLIED', 'SANCTIONED', 'DISBURSED'] } },
        null,
        { session },
      );
      if (active) {
        throw new ConflictError('You already have an active application for this product', {
          loanRef: active.loanRef,
          productCode: product.code,
        });
      }

      // 6. compute with the product rate + snapshot terms
      const { simpleInterest, totalRepayment } = computeRepayment(principal, input.tenureDays, product.interestRate);
      const loanRef = await generateLoanRef(session);
      const [loan] = await Loan.create(
        [
          {
            loanRef,
            borrower: new Types.ObjectId(userId),
            product: product._id,
            productCode: product.code,
            productName: product.name,
            principal,
            tenureDays: input.tenureDays,
            interestRate: product.interestRate,
            simpleInterest,
            totalRepayment,
            amountPaid: 0,
            outstanding: totalRepayment,
            status: 'APPLIED',
            salarySlip: profile.pendingSalarySlip,
            statusHistory: [{ from: null, to: 'APPLIED', by: new Types.ObjectId(userId), at: new Date() }],
          },
        ],
        { session },
      );
      // 7. clear the staged slip
      await BorrowerProfile.updateOne({ _id: profile._id }, { $unset: { pendingSalarySlip: '' } }, { session });
      createdLoan = loan;
    });
    return createdLoan;
  } finally {
    await session.endSession();
  }
}
```

> The standalone global `profile.eligibility.passed` gate is intentionally removed: product eligibility (step 4) is the authoritative gate, and PERSONAL's thresholds equal the former globals, so previously-blocked applicants are still blocked (now as 422 `PRODUCT_ELIGIBILITY_FAILED`). `ValidationError` remains imported because `upsertProfile` still uses it.

- [ ] **Step 6: Migrate the existing apply-calling suites to the helper**

In each of the four files below, add the import and replace every `await agent.post('/api/v1/borrower/loans').send({ principal: X, tenureDays: Y })` with `await applyLoan(agent, { principal: X, tenureDays: Y })`.

`tests/modules/borrower/apply.int.test.ts` — add at the top with the other imports:
```ts
import { applyLoan } from '../../helpers/apply-loan';
```
Replace the two apply POSTs:
```ts
    const res = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
```
```ts
    await applyLoan(agent, { principal: 100000, tenureDays: 90 });
```
And the "blocks apply when slip not staged" test's POST:
```ts
    const res = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
```

`tests/modules/borrower/active-application.int.test.ts` — add the import; replace the first and second apply POSTs with `applyLoan(agent, { principal: 200000, tenureDays: 60 })` and `applyLoan(agent, { principal: 100000, tenureDays: 90 })`. (Both default to `PERSONAL`, so the same-product 409 still holds.) Also assert the new detail field — change the final expectation to additionally check:
```ts
    expect(second.body.error.details.productCode).toBe('PERSONAL');
```

`tests/modules/loans/transitions.int.test.ts` — add the import; replace the apply POST (line ~22) with:
```ts
  const loan = await applyLoan(agent, { principal: 200000, tenureDays: 60 });
```

`tests/modules/payments/payments.int.test.ts` — add the import; this suite has a single apply POST inside the `disbursedLoan()` helper (line ~22), using a `borrower` agent and wrapped in `(...).body`. Replace it exactly:
```ts
  const loan = (await applyLoan(borrower, { principal: 200000, tenureDays: 60 })).body;
```
(Each test calls `disbursedLoan()` with a fresh borrower, so the per-product guard never trips.)

- [ ] **Step 7: Run the changed suites to verify they pass**

Run: `bun run test tests/modules/borrower/apply-product.int.test.ts tests/modules/borrower/apply.int.test.ts tests/modules/borrower/active-application.int.test.ts tests/modules/loans/transitions.int.test.ts tests/modules/payments/payments.int.test.ts`
Expected: PASS — new product suite (7 tests) green; all four migrated suites green with `productCode` defaulted via the helper.

- [ ] **Step 8: Run the FULL backend suite (regression gate)**

Run: `bun run test`
Expected: PASS — all suites green (this confirms the math/BRE param defaults and the apply rewrite broke nothing).

- [ ] **Step 9: Commit**

```bash
git add src/modules/borrower/borrower.dto.ts src/modules/borrower/borrower.service.ts tests/helpers/apply-loan.ts tests/modules/borrower/apply.int.test.ts tests/modules/borrower/active-application.int.test.ts tests/modules/loans/transitions.int.test.ts tests/modules/payments/payments.int.test.ts tests/modules/borrower/apply-product.int.test.ts
git commit -m "feat(borrower): product-scoped loan application with term snapshot + per-product one-active guard"
```

---

## Notes for the implementer

- **Do not** change `GET /public/config` — it stays for the marketing fallback (Part A frontend).
- **Do not** touch the loans-list filters, metrics, or loan-detail timeline — those are Part B.
- The borrower never gets `product:read`; the borrower catalog uses the **public** `/public/products` endpoint (consumed by Part A frontend).
- When migrating the four apply suites, keep each call's original principal/tenure numbers so existing math assertions stay valid; only the product defaulting changes behavior.
- Every test command must be prefixed with the Node-20 PATH export (see Global Constraints).
