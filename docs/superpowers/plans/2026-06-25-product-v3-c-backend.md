# Product v3 — Part B Admin Dashboard (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend that powers the admin portfolio dashboard — a metrics aggregation endpoint, rich loan-list filtering, and a per-loan audit timeline — all derived from existing Loan/Payment data.

**Architecture:** Three changes to the existing Express/Mongoose backend: (1) a new `metrics` module exposing `GET /api/v1/admin/metrics` built from MongoDB `$facet`/`$group` aggregations over the `loans` and `payments` collections; (2) the existing `GET /api/v1/loans` list gains filter/sort/search query params while keeping its `Paginated<Loan>` response shape; (3) `GET /api/v1/loans/:id` gains a `payments` array and an assembled `timeline` derived at read time from `statusHistory`, `sanction`, `disbursement`, and payment docs (no new collection).

**Tech Stack:** Node 20, Express 4, TypeScript 5 (strict), Mongoose 8, MongoDB 7 (replica set), zod 3, Jest + ts-jest + supertest + mongodb-memory-server (ReplSet), Bun.

## Global Constraints

- **Tooling:** Bun everywhere (`bun install`, `bun add`, `bunx`, `bun run <script>`). Run tests with `bun run test <path>` — NEVER `bun test`. Node 20 must be on PATH (`export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH`) before any test command.
- **Money:** integer **paise** in DB and all internal math; APIs return **rupees** at the edge via `paiseToRupees` (`src/lib/money.ts`). Every money field in the metrics response and the loan detail is rupee-denominated.
- **RBAC:** routes gated by `authorize('<perm>')` after `authenticate`. `metrics:read` gates the metrics endpoint; `loan:read:all` gates the loans list and detail. (`metrics:read` is seeded by Part A and granted to ADMIN.)
- **Backwards compatibility:** the existing `GET /api/v1/loans` response stays `{ data: Loan[], pagination: { page, limit, total } }`; existing callers passing only `status`/`page`/`limit` keep working. The existing `GET /api/v1/loans/:id` keeps returning the loan; it only gains `payments` and `timeline` fields.
- **Models:** all models are registered via `src/models/index.ts`; `import './models'` stays in `app.ts`. Loan money fields: `principal`, `amountPaid`, `outstanding`, `totalRepayment`, `simpleInterest` (paise). Loan snapshot fields from Part A: `product`, `productCode`, `productName`, `interestRate`.

---

### Task 1: Loans list — filtering, search, sort

**Files:**
- Modify: `src/modules/loans/loans.dto.ts` (extend `listLoansQuery`)
- Modify: `src/modules/loans/loans.service.ts` (`listLoans`)
- Test: `tests/modules/loans/list-filters.int.test.ts` (create)

**Interfaces:**
- Consumes: `Loan` model (`src/models/loan.model.ts`); `rupeesToPaise` (`src/lib/money.ts`); `authorize` middleware (already wired on the route).
- Produces: `listLoans(filter)` where
  ```ts
  filter: {
    status?: 'APPLIED'|'SANCTIONED'|'REJECTED'|'DISBURSED'|'CLOSED';
    productCode?: string;
    from?: Date; to?: Date;          // createdAt window
    q?: string;                       // loanRef / borrower fullName / borrower email (case-insensitive)
    minAmount?: number; maxAmount?: number;  // RUPEES on principal
    sort?: '-createdAt'|'createdAt'|'principal'|'-principal'|'outstanding'|'-outstanding';
    page: number; limit: number;
  }
  ```
  Returns `{ data: Loan[], pagination: { page, limit, total } }` (unchanged shape), `borrower` populated with `fullName email`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/loans/list-filters.int.test.ts`. It seeds loans across statuses/products/amounts/dates by inserting directly, then exercises each filter through the HTTP endpoint as an admin.

```ts
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { Loan } from '../../../src/models/loan.model';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

const slip = { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 };
let borrowerId: Types.ObjectId;

async function makeLoan(over: Record<string, unknown>) {
  const base = {
    loanRef: `T-${Math.random().toString(36).slice(2, 10)}`,
    borrower: borrowerId,
    principal: 20000000, tenureDays: 60, interestRate: 12,
    simpleInterest: 394521, totalRepayment: 20394521, amountPaid: 0, outstanding: 20394521,
    status: 'APPLIED', salarySlip: slip,
    productCode: 'PERSONAL', productName: 'Personal Loan',
    statusHistory: [{ from: null, to: 'APPLIED', by: borrowerId, at: new Date() }],
  };
  return Loan.create({ ...base, ...over });
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
  const b = await User.findOne({ email: 'borrower@lms.test' });
  borrowerId = b!._id as Types.ObjectId;
  // 5 loans: vary status, product, principal, createdAt
  await makeLoan({ loanRef: 'L-A', status: 'APPLIED', principal: 5000000, productCode: 'PERSONAL', createdAt: new Date('2026-01-10') });
  await makeLoan({ loanRef: 'L-B', status: 'DISBURSED', principal: 30000000, productCode: 'PERSONAL', createdAt: new Date('2026-03-10') });
  await makeLoan({ loanRef: 'L-C', status: 'REJECTED', principal: 8000000, productCode: 'SALARY_ADVANCE', createdAt: new Date('2026-05-10') });
  await makeLoan({ loanRef: 'L-D', status: 'CLOSED', principal: 12000000, productCode: 'SALARY_ADVANCE', createdAt: new Date('2026-06-01') });
  await makeLoan({ loanRef: 'L-E', status: 'DISBURSED', principal: 50000000, productCode: 'PERSONAL', createdAt: new Date('2026-06-20') });
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /loans filters', () => {
  it('filters by status', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?status=DISBURSED');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-B', 'L-E']);
  });
  it('filters by productCode', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?productCode=SALARY_ADVANCE');
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-C', 'L-D']);
  });
  it('filters by createdAt range', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?from=2026-05-01&to=2026-06-10');
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-C', 'L-D']);
  });
  it('filters by amount range (rupees on principal)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?minAmount=100000&maxAmount=350000');
    // principals in rupees: L-A 50k, L-B 300k, L-C 80k, L-D 120k, L-E 500k
    expect(res.body.data.map((l: any) => l.loanRef).sort()).toEqual(['L-B', 'L-D']);
  });
  it('searches by loanRef (q)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?q=L-C');
    expect(res.body.data.map((l: any) => l.loanRef)).toEqual(['L-C']);
  });
  it('searches by borrower email (q)', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?q=borrower@lms.test&limit=100');
    expect(res.body.data.length).toBe(5);
  });
  it('sorts by principal ascending', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?sort=principal&limit=100');
    const refs = res.body.data.map((l: any) => l.loanRef);
    expect(refs[0]).toBe('L-A'); // smallest principal
    expect(refs[refs.length - 1]).toBe('L-E'); // largest
  });
  it('paginates', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans?limit=2&page=1');
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans/list-filters.int.test.ts`
Expected: FAIL — filters ignored (e.g. productCode/amount/q/sort assertions fail) because `listLoans` only honors `status`.

- [ ] **Step 3: Extend the query DTO**

Replace `listLoansQuery` in `src/modules/loans/loans.dto.ts`:

```ts
import { z } from 'zod';
export const rejectDto = z.object({ reason: z.string().min(3).max(500) });

export const listLoansQuery = z.object({
  status: z.enum(['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED']).optional(),
  productCode: z.string().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().min(1).max(120).optional(),
  minAmount: z.coerce.number().nonnegative().optional(), // rupees
  maxAmount: z.coerce.number().nonnegative().optional(), // rupees
  sort: z
    .enum(['-createdAt', 'createdAt', 'principal', '-principal', 'outstanding', '-outstanding'])
    .default('-createdAt'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

- [ ] **Step 4: Implement filtering in the service**

Replace `listLoans` in `src/modules/loans/loans.service.ts` (add the `User` + `rupeesToPaise` imports at the top of the file):

```ts
import { Types } from 'mongoose';
import { Loan } from '../../models/loan.model';
import { User } from '../../models/user.model';
import { rupeesToPaise } from '../../lib/money';
import { NotFoundError } from '../../lib/errors';
import { nextStatus, LoanAction } from './state-machine';

type ListFilter = {
  status?: string;
  productCode?: string;
  from?: Date;
  to?: Date;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  sort: string;
  page: number;
  limit: number;
};

export async function listLoans(filter: ListFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.productCode) query.productCode = filter.productCode;
  if (filter.from || filter.to) {
    const createdAt: Record<string, Date> = {};
    if (filter.from) createdAt.$gte = filter.from;
    if (filter.to) createdAt.$lte = filter.to;
    query.createdAt = createdAt;
  }
  if (filter.minAmount != null || filter.maxAmount != null) {
    const principal: Record<string, number> = {};
    if (filter.minAmount != null) principal.$gte = rupeesToPaise(filter.minAmount);
    if (filter.maxAmount != null) principal.$lte = rupeesToPaise(filter.maxAmount);
    query.principal = principal;
  }
  if (filter.q) {
    const rx = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchedUsers = await User.find({ $or: [{ fullName: rx }, { email: rx }] }, '_id');
    const ids = matchedUsers.map((u) => u._id as Types.ObjectId);
    query.$or = [{ loanRef: rx }, { borrower: { $in: ids } }];
  }
  const total = await Loan.countDocuments(query);
  const data = await Loan.find(query)
    .sort(filter.sort)
    .skip((filter.page - 1) * filter.limit)
    .limit(filter.limit)
    .populate('borrower', 'fullName email');
  return { data, pagination: { page: filter.page, limit: filter.limit, total } };
}
```

(Leave `getLoan` and the transition functions in place — they change in Task 2.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans/list-filters.int.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 6: Run the existing loans suite to confirm no regression**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans`
Expected: PASS (transitions suite still green — it only passes `status`/`page`/`limit`).

- [ ] **Step 7: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-backend
git add src/modules/loans/loans.dto.ts src/modules/loans/loans.service.ts tests/modules/loans/list-filters.int.test.ts
git commit -m "feat(loans): filter/search/sort the admin loans list"
```

---

### Task 2: Loan detail — payments + assembled audit timeline

**Files:**
- Modify: `src/modules/loans/loans.service.ts` (`getLoan`)
- Modify: `src/modules/loans/loans.controller.ts` (`detail` — no signature change, but confirm it returns the new shape)
- Test: `tests/modules/loans/detail-timeline.int.test.ts` (create)

**Interfaces:**
- Consumes: `Loan`, `Payment` (`src/models/payment.model.ts`), `User`; `paiseToRupees`.
- Produces: `getLoan(id)` returns
  ```ts
  {
    loan: <Loan with borrower populated, money in rupees>,
    payments: Array<{ _id, utr, amount /*rupees*/, paidAt, recordedBy: { id, name } | null }>,
    timeline: Array<{ type: 'STATUS' | 'SANCTION' | 'DISBURSEMENT' | 'PAYMENT';
                      at: Date;
                      actor: { id: string; name: string } | null;
                      detail: string }>   // ascending by `at`
  }
  ```
  Note: the controller already does `res.json(await service.getLoan(...))`, so changing the service return value is sufficient.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/loans/detail-timeline.int.test.ts`. It drives a real loan through applied→sanction→disburse→payment→closed via the HTTP API (so actors are real users), then asserts the timeline ordering and actor attribution.

```ts
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { signupBorrower } from '../../helpers/signup-borrower';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/upload-url'),
  getDownloadUrl: jest.fn().mockResolvedValue('http://minio/download-url'),
}));

let mem: MongoMemoryReplSet;
const app = createApp();

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}

async function fullCycleLoan() {
  const borrower = request.agent(app);
  await signupBorrower(borrower);
  await borrower.put('/api/v1/borrower/profile').send({ fullName: 'Rahul', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await borrower.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await borrower.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  const applied = await borrower.post('/api/v1/borrower/loans').send({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
  const id = applied.body._id;
  const total = applied.body.totalRepayment; // paise
  await (await loginAs('sanction@lms.test', 'Sanction@123')).post(`/api/v1/loans/${id}/sanction`).send({});
  await (await loginAs('disbursement@lms.test', 'Disburse@123')).post(`/api/v1/loans/${id}/disburse`).send({});
  await (await loginAs('collection@lms.test', 'Collect@123'))
    .post(`/api/v1/loans/${id}/payments`)
    .send({ utr: 'UTR-DETAIL-1', amount: total / 100, paidAt: '2026-06-25' });
  return id;
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /loans/:id detail + timeline', () => {
  it('returns payments and an ordered audit timeline with actors', async () => {
    const id = await fullCycleLoan();
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get(`/api/v1/loans/${id}`);
    expect(res.status).toBe(200);

    // payments in rupees
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].utr).toBe('UTR-DETAIL-1');
    expect(res.body.payments[0].recordedBy.name).toBe('Collection Exec');

    // timeline ascending, covering the full lifecycle
    const types = res.body.timeline.map((t: any) => t.type);
    expect(types).toEqual(['STATUS', 'STATUS', 'STATUS', 'PAYMENT', 'STATUS']);
    const ats = res.body.timeline.map((t: any) => new Date(t.at).getTime());
    expect(ats).toEqual([...ats].sort((a, b) => a - b)); // ascending

    // actor attribution
    const sanctionEntry = res.body.timeline.find((t: any) => t.detail.includes('SANCTIONED'));
    expect(sanctionEntry.actor.name).toBe('Sanction Exec');
    const disburseEntry = res.body.timeline.find((t: any) => t.detail.includes('DISBURSED'));
    expect(disburseEntry.actor.name).toBe('Disbursement Exec');
    const closedEntry = res.body.timeline.find((t: any) => t.detail.includes('CLOSED'));
    expect(closedEntry).toBeTruthy();
  });

  it('404s an unknown loan', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/loans/64b0000000000000000000aa');
    expect(res.status).toBe(404);
  });
});
```

(The lifecycle above produces five timeline entries: three STATUS transitions recorded in `statusHistory` — APPLIED, SANCTIONED, DISBURSED — plus one PAYMENT, plus the CLOSE STATUS transition appended by the payment service. The payment timestamp falls between the DISBURSED transition and the CLOSE transition, so ordering is `STATUS×3, PAYMENT, STATUS`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans/detail-timeline.int.test.ts`
Expected: FAIL — `res.body.payments`/`res.body.timeline` are undefined because `getLoan` returns the bare loan.

- [ ] **Step 3: Implement the timeline assembly in the service**

Replace `getLoan` in `src/modules/loans/loans.service.ts` and add the `Payment` import:

```ts
import { Payment } from '../../models/payment.model';
import { paiseToRupees } from '../../lib/money';

type Actor = { id: string; name: string } | null;
type TimelineEntry = { type: 'STATUS' | 'SANCTION' | 'DISBURSEMENT' | 'PAYMENT'; at: Date; actor: Actor; detail: string };

export async function getLoan(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Loan not found');
  const loan = await Loan.findById(id)
    .populate('borrower', 'fullName email')
    .populate('statusHistory.by', 'fullName')
    .populate('sanction.decidedBy', 'fullName')
    .populate('disbursement.by', 'fullName');
  if (!loan) throw new NotFoundError('Loan not found');

  const paymentDocs = await Payment.find({ loan: loan._id })
    .sort({ paidAt: 1 })
    .populate('recordedBy', 'fullName');

  const actorOf = (ref: any): Actor =>
    ref && ref._id ? { id: ref._id.toString(), name: ref.fullName } : null;

  const timeline: TimelineEntry[] = [];
  for (const h of loan.statusHistory as any[]) {
    timeline.push({
      type: 'STATUS',
      at: h.at,
      actor: actorOf(h.by),
      detail: h.from ? `${h.from} → ${h.to}${h.reason ? ` (${h.reason})` : ''}` : `Created as ${h.to}`,
    });
  }
  for (const p of paymentDocs) {
    timeline.push({
      type: 'PAYMENT',
      at: p.paidAt as Date,
      actor: actorOf((p as any).recordedBy),
      detail: `Payment ₹${paiseToRupees(p.amount as number).toLocaleString('en-IN')} (UTR ${p.utr})`,
    });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const payments = paymentDocs.map((p) => ({
    _id: p._id,
    utr: p.utr,
    amount: paiseToRupees(p.amount as number),
    paidAt: p.paidAt,
    recordedBy: actorOf((p as any).recordedBy),
  }));

  return { loan, payments, timeline };
}
```

(Note: the loan's own money fields stay paise in this response; the frontend already formats loan money via `formatRupees`. `payments[].amount` is rupees as specified. If the existing detail test asserted the bare loan shape, see Step 5.)

- [ ] **Step 4: Run the new test to verify it passes**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans/detail-timeline.int.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Run the existing loans + payments suites for regressions**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/loans tests/modules/payments`
Expected: PASS. If a prior test asserted `GET /loans/:id` returned the loan object directly (e.g. `res.body.loanRef`), update that assertion to `res.body.loan.loanRef` — the detail response is now `{ loan, payments, timeline }`. Make that edit if and only if the run reports such a failure.

- [ ] **Step 6: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-backend
git add src/modules/loans/loans.service.ts tests/modules/loans/detail-timeline.int.test.ts
git commit -m "feat(loans): loan detail returns payments + assembled audit timeline"
```

---

### Task 3: Metrics module — `GET /api/v1/admin/metrics`

**Files:**
- Create: `src/modules/metrics/metrics.service.ts`
- Create: `src/modules/metrics/metrics.controller.ts`
- Create: `src/modules/metrics/metrics.routes.ts`
- Modify: `src/routes.ts` (mount the metrics router under `/admin`)
- Test: `tests/modules/metrics/metrics.int.test.ts` (create)

**Interfaces:**
- Consumes: `Loan`, `Payment`; `paiseToRupees`; `authenticate`, `authorize('metrics:read')`, `asyncHandler`.
- Produces: `GET /api/v1/admin/metrics` →
  ```ts
  {
    kpis: {
      totalDisbursed: number;     // rupees, Σ principal where status in [DISBURSED, CLOSED]
      totalRecovered: number;     // rupees, Σ amountPaid (all loans)
      outstandingBook: number;    // rupees, Σ outstanding where status = DISBURSED
      activeLoans: number;        // count DISBURSED
      totalApplications: number;  // count all
      approvalRate: number;       // percent 0..100, 1 dp; approved/decided
      rejectedCount: number;
      rejectionRate: number;      // percent 0..100, 1 dp; rejected/decided
      avgTicketSize: number;      // rupees, mean principal where status in [DISBURSED, CLOSED]
    };
    byStatus: Array<{ status: string; count: number }>;
    funnel: { applied: number; sanctioned: number; disbursed: number; closed: number; rejected: number };
    timeSeries: Array<{ month: string /* YYYY-MM */; disbursed: number; recovered: number }>; // last 12 months
    byProduct: Array<{ productCode: string; productName: string; applicants: number; borrowed: number; recovered: number; outstanding: number; active: number; rejected: number; approvalRate: number }>;
  }
  ```
  `decided = totalApplications − count(APPLIED)`. Rates are `0` when `decided === 0`.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/metrics/metrics.int.test.ts`. Seed a fully deterministic fixture by inserting loans + payments directly, then assert exact numbers.

```ts
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { Loan } from '../../../src/models/loan.model';
import { Payment } from '../../../src/models/payment.model';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryReplSet;
const app = createApp();
let borrowerId: Types.ObjectId;
let collectorId: Types.ObjectId;

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password });
  return agent;
}
const slip = { objectKey: 'k', filename: 'f.pdf', mime: 'application/pdf', size: 1 };

async function makeLoan(over: Record<string, unknown>) {
  const base = {
    loanRef: `M-${Math.random().toString(36).slice(2, 10)}`,
    borrower: borrowerId, principal: 10000000, tenureDays: 60, interestRate: 12,
    simpleInterest: 0, totalRepayment: 10000000, amountPaid: 0, outstanding: 10000000,
    status: 'APPLIED', salarySlip: slip, productCode: 'PERSONAL', productName: 'Personal Loan',
    statusHistory: [{ from: null, to: 'APPLIED', by: borrowerId, at: new Date('2026-06-01') }],
  };
  return Loan.create({ ...base, ...over });
}

beforeAll(async () => {
  mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDb(mem.getUri());
  await runSeed();
  borrowerId = (await User.findOne({ email: 'borrower@lms.test' }))!._id as Types.ObjectId;
  collectorId = (await User.findOne({ email: 'collection@lms.test' }))!._id as Types.ObjectId;

  // Fixture (principals in paise):
  // PERSONAL: 1 APPLIED(100k), 1 DISBURSED(200k, paid 50k, outstanding 150k), 1 CLOSED(300k, paid 300k)
  // SALARY_ADVANCE: 1 REJECTED(80k), 1 DISBURSED(120k, paid 0)
  await makeLoan({ status: 'APPLIED', principal: 10000000 });
  const d1 = await makeLoan({ status: 'DISBURSED', principal: 20000000, amountPaid: 5000000, outstanding: 15000000, disbursement: { by: borrowerId, at: new Date('2026-06-05') } });
  await makeLoan({ status: 'CLOSED', principal: 30000000, amountPaid: 30000000, outstanding: 0, disbursement: { by: borrowerId, at: new Date('2026-06-10') } });
  await makeLoan({ status: 'REJECTED', principal: 8000000, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance' });
  const d2 = await makeLoan({ status: 'DISBURSED', principal: 12000000, amountPaid: 0, outstanding: 12000000, productCode: 'SALARY_ADVANCE', productName: 'Salary Advance', disbursement: { by: borrowerId, at: new Date('2026-06-15') } });

  await Payment.create([
    { loan: d1._id, utr: 'P1', amount: 5000000, paidAt: new Date('2026-06-20'), recordedBy: collectorId },
    { loan: (await Loan.findOne({ status: 'CLOSED' }))!._id, utr: 'P2', amount: 30000000, paidAt: new Date('2026-06-22'), recordedBy: collectorId },
  ]);
});
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /admin/metrics', () => {
  it('403s a role without metrics:read', async () => {
    const sales = await loginAs('sales@lms.test', 'Sales@123');
    const res = await sales.get('/api/v1/admin/metrics');
    expect(res.status).toBe(403);
  });

  it('returns correct KPIs, funnel, byStatus, byProduct', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/admin/metrics');
    expect(res.status).toBe(200);
    const { kpis, byStatus, funnel, byProduct } = res.body;

    // totalDisbursed = 200k + 300k + 120k = 620,000 rupees
    expect(kpis.totalDisbursed).toBe(620000);
    // totalRecovered = 50k + 300k = 350,000
    expect(kpis.totalRecovered).toBe(350000);
    // outstandingBook (DISBURSED only) = 150k + 120k = 270,000
    expect(kpis.outstandingBook).toBe(270000);
    expect(kpis.activeLoans).toBe(2);
    expect(kpis.totalApplications).toBe(5);
    // decided = 5 - 1 applied = 4; approved (SANCTIONED+DISBURSED+CLOSED) = 3 → 75.0
    expect(kpis.approvalRate).toBe(75);
    expect(kpis.rejectedCount).toBe(1);
    expect(kpis.rejectionRate).toBe(25);
    // avgTicketSize over disbursed/closed (200k,300k,120k) = 620000/3 = 206666.67 → round
    expect(kpis.avgTicketSize).toBe(206667);

    const statusMap = Object.fromEntries(byStatus.map((s: any) => [s.status, s.count]));
    expect(statusMap).toMatchObject({ APPLIED: 1, DISBURSED: 2, CLOSED: 1, REJECTED: 1 });

    expect(funnel).toEqual({ applied: 5, sanctioned: 3, disbursed: 3, closed: 1, rejected: 1 });

    const personal = byProduct.find((p: any) => p.productCode === 'PERSONAL');
    expect(personal).toMatchObject({ applicants: 3, borrowed: 500000, recovered: 350000, outstanding: 150000, active: 1, rejected: 0 });
    const sa = byProduct.find((p: any) => p.productCode === 'SALARY_ADVANCE');
    expect(sa).toMatchObject({ applicants: 2, borrowed: 120000, recovered: 0, outstanding: 120000, active: 1, rejected: 1 });
  });

  it('returns a 12-month time series including June 2026 disbursed and recovered', async () => {
    const admin = await loginAs('admin@lms.test', 'Admin@123');
    const res = await admin.get('/api/v1/admin/metrics');
    const ts = res.body.timeSeries;
    expect(ts).toHaveLength(12);
    expect(ts.every((m: any) => /^\d{4}-\d{2}$/.test(m.month))).toBe(true);
    const june = ts.find((m: any) => m.month === '2026-06');
    expect(june).toBeTruthy();
    // disbursed in June (by disbursement.at): 200k + 300k + 120k = 620,000
    expect(june.disbursed).toBe(620000);
    // recovered in June (by paidAt): 50k + 300k = 350,000
    expect(june.recovered).toBe(350000);
  });
});
```

(The time-series test pins June 2026 specifically, which the fixture dates fall in; the surrounding 11 months are present but zero. The 12-month window ends at the current month; since "today" is 2026-06-25 the window includes `2026-06`. If this plan is executed in a later month, change the fixture dates to the current month — keep the disbursement/payment dates inside the window.)

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/metrics/metrics.int.test.ts`
Expected: FAIL — route 404 (not mounted yet).

- [ ] **Step 3: Implement the metrics service**

Create `src/modules/metrics/metrics.service.ts`:

```ts
import { Loan } from '../../models/loan.model';
import { Payment } from '../../models/payment.model';
import { paiseToRupees } from '../../lib/money';

const DISBURSED_OR_CLOSED = ['DISBURSED', 'CLOSED'];
const APPROVED = ['SANCTIONED', 'DISBURSED', 'CLOSED'];

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal place
}

function lastTwelveMonths(now: Date): string[] {
  const months: string[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export async function getMetrics() {
  const [facet] = await Loan.aggregate([
    {
      $facet: {
        kpis: [
          {
            $group: {
              _id: null,
              totalDisbursed: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              totalRecovered: { $sum: '$amountPaid' },
              outstandingBook: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, '$outstanding', 0] } },
              activeLoans: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, 1, 0] } },
              totalApplications: { $sum: 1 },
              approvedCount: { $sum: { $cond: [{ $in: ['$status', APPROVED] }, 1, 0] } },
              rejectedCount: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
              appliedCount: { $sum: { $cond: [{ $eq: ['$status', 'APPLIED'] }, 1, 0] } },
              disbursedSum: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              disbursedCount: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, 1, 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byProduct: [
          {
            $group: {
              _id: { code: '$productCode', name: '$productName' },
              applicants: { $sum: 1 },
              borrowed: { $sum: { $cond: [{ $in: ['$status', DISBURSED_OR_CLOSED] }, '$principal', 0] } },
              recovered: { $sum: '$amountPaid' },
              outstanding: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, '$outstanding', 0] } },
              active: { $sum: { $cond: [{ $eq: ['$status', 'DISBURSED'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
              approved: { $sum: { $cond: [{ $in: ['$status', APPROVED] }, 1, 0] } },
              applied: { $sum: { $cond: [{ $eq: ['$status', 'APPLIED'] }, 1, 0] } },
            },
          },
        ],
        disbursedByMonth: [
          { $match: { 'disbursement.at': { $ne: null } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$disbursement.at' } },
              disbursed: { $sum: '$principal' },
            },
          },
        ],
      },
    },
  ]);

  const recoveredByMonth = await Payment.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, recovered: { $sum: '$amount' } } },
  ]);

  const k = facet.kpis[0] ?? {
    totalDisbursed: 0, totalRecovered: 0, outstandingBook: 0, activeLoans: 0,
    totalApplications: 0, approvedCount: 0, rejectedCount: 0, appliedCount: 0, disbursedSum: 0, disbursedCount: 0,
  };
  const decided = k.totalApplications - k.appliedCount;

  const kpis = {
    totalDisbursed: paiseToRupees(k.totalDisbursed),
    totalRecovered: paiseToRupees(k.totalRecovered),
    outstandingBook: paiseToRupees(k.outstandingBook),
    activeLoans: k.activeLoans,
    totalApplications: k.totalApplications,
    approvalRate: pct(k.approvedCount, decided),
    rejectedCount: k.rejectedCount,
    rejectionRate: pct(k.rejectedCount, decided),
    avgTicketSize: k.disbursedCount === 0 ? 0 : paiseToRupees(Math.round(k.disbursedSum / k.disbursedCount)),
  };

  const byStatus = facet.byStatus.map((s: any) => ({ status: s._id, count: s.count }));
  const statusCount = (st: string) => facet.byStatus.find((s: any) => s._id === st)?.count ?? 0;
  const funnel = {
    applied: k.totalApplications,
    sanctioned: statusCount('SANCTIONED') + statusCount('DISBURSED') + statusCount('CLOSED'),
    disbursed: statusCount('DISBURSED') + statusCount('CLOSED'),
    closed: statusCount('CLOSED'),
    rejected: statusCount('REJECTED'),
  };

  const byProduct = facet.byProduct
    .filter((p: any) => p._id.code) // ignore legacy loans with no product
    .map((p: any) => {
      const productDecided = p.applicants - p.applied;
      return {
        productCode: p._id.code,
        productName: p._id.name,
        applicants: p.applicants,
        borrowed: paiseToRupees(p.borrowed),
        recovered: paiseToRupees(p.recovered),
        outstanding: paiseToRupees(p.outstanding),
        active: p.active,
        rejected: p.rejected,
        approvalRate: pct(p.approved, productDecided),
      };
    })
    .sort((a: any, b: any) => a.productName.localeCompare(b.productName));

  const disbursedMap = new Map<string, number>(facet.disbursedByMonth.map((m: any) => [m._id, m.disbursed]));
  const recoveredMap = new Map<string, number>(recoveredByMonth.map((m: any) => [m._id, m.recovered]));
  const timeSeries = lastTwelveMonths(new Date()).map((month) => ({
    month,
    disbursed: paiseToRupees(disbursedMap.get(month) ?? 0),
    recovered: paiseToRupees(recoveredMap.get(month) ?? 0),
  }));

  return { kpis, byStatus, funnel, timeSeries, byProduct };
}
```

- [ ] **Step 4: Implement the controller**

Create `src/modules/metrics/metrics.controller.ts`:

```ts
import { Request, Response } from 'express';
import * as service from './metrics.service';

export async function metrics(_req: Request, res: Response) {
  res.json(await service.getMetrics());
}
```

- [ ] **Step 5: Implement the router**

Create `src/modules/metrics/metrics.routes.ts`:

```ts
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as c from './metrics.controller';

export const metricsRouter = Router();
metricsRouter.use(authenticate, authorize('metrics:read'));
metricsRouter.get('/metrics', asyncHandler(c.metrics));
```

- [ ] **Step 6: Mount the router under `/admin`**

In `src/routes.ts`, after the existing `rbacRouter` mount, add:

```ts
import { metricsRouter } from './modules/metrics/metrics.routes';
apiRouter.use('/admin', metricsRouter);
```

(Both `rbacRouter` and `metricsRouter` mount at `/admin`; Express composes them — `/admin/roles` is served by rbac, `/admin/metrics` by metrics. Each router has its own `authorize`, so the permissions stay independent.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test tests/modules/metrics/metrics.int.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 8: Run the full backend suite for regressions**

Run: `export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && cd /Users/gyankumar/Personal/LMS/lms-backend && bun run test`
Expected: PASS (whole suite green, including Part A tests).

- [ ] **Step 9: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-backend
git add src/modules/metrics src/routes.ts tests/modules/metrics/metrics.int.test.ts
git commit -m "feat(metrics): admin portfolio metrics endpoint (KPIs, funnel, by-product, time series)"
```

---

## Self-Review

**Spec coverage (B1–B3):**
- B1 metrics endpoint — Task 3 (KPIs, byStatus, funnel, timeSeries last-12-months, byProduct; `metrics:read` gate + 403 test). ✅
- B2 loans-list filters (status, productCode, from/to, q, minAmount/maxAmount, sort, page/limit; `Paginated<Loan>` preserved; borrower populated) — Task 1. ✅
- B3 loan detail + payments + assembled timeline (statusHistory + sanction + disbursement + payments, ascending, actor attribution, no new collection) — Task 2. ✅

**Placeholder scan:** No TBD/TODO; every code step has complete code; every test step has a real body and an exact `bun run test` command. ✅

**Type/signature consistency:** `listLoans(filter)` filter type matches the DTO fields; `getLoan` returns `{ loan, payments, timeline }` consistently (controller already `res.json`s the return value, and Task 2 Step 5 flags the one possible legacy-assertion fix); metrics response shape matches the Interfaces block and the test assertions; money is rupees at the edge throughout via `paiseToRupees`. ✅

**Cross-task ordering note:** Tasks 1 and 2 both edit `loans.service.ts`; they touch different functions (`listLoans` vs `getLoan`) and Task 1's imports (`User`, `rupeesToPaise`) plus Task 2's imports (`Payment`, `paiseToRupees`) are additive. Execute in order 1→2→3.
