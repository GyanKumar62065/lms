# Product v2 — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the LMS backend for Product v2 — richer registration (firstName/lastName/IN-phone) with a self-hosted SVG captcha, a public landing-config endpoint, first-party analytics ingest, and a one-active-application rule.

**Architecture:** Additive changes to the existing feature-modular Express+TS+Mongoose backend. New collections `Captcha` (TTL) and `Event`; `User` gains firstName/lastName/phone. New endpoints under the existing `/api/v1` router. No change to the loan lifecycle, RBAC, payments, or auth-token mechanics.

**Tech Stack:** existing (Express 4, TS strict, Mongoose 8, zod 3, Jest, Bun) + `svg-captcha`.

## Global Constraints

- Package manager/runner: **Bun**. Tests via **`bun run test`** (Jest) — never `bun test`. Prepend Node 20: `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"` (default node is v14).
- TypeScript `strict: true`. Money stays integer paise. HTTP codes: 401 unauthenticated · 403 forbidden · 404 not-found/not-owned · 409 conflict · 422 validation.
- Phone: IN mobile `^[6-9]\d{9}$`, stored on `User.phone`, **unique** (sparse index so existing phone-less staff accounts are fine).
- Captcha: self-hosted via `svg-captcha`; one-time, TTL ~300s; verify+consume before user creation; failure → 422 `CAPTCHA_INVALID`.
- Re-apply rule: block `POST /borrower/loans` with 409 `ACTIVE_APPLICATION_EXISTS` if the borrower has a loan in `APPLIED|SANCTIONED|DISBURSED`.
- `fullName` remains the canonical display field, set = `firstName + ' ' + lastName` at signup.
- Every change ends with a conventional commit. Work in `/Users/gyankumar/Personal/LMS/lms-backend`.

---

## File Structure

```
src/
├── models/captcha.model.ts        NEW: { answerHash, expiresAt (TTL) }
├── models/event.model.ts          NEW: analytics event
├── models/user.model.ts           MODIFY: +firstName,+lastName,+phone(unique sparse)
├── models/index.ts                MODIFY: export the 2 new models
├── lib/captcha.ts                 NEW: generate()/verify() wrapping svg-captcha + hash
├── modules/auth/auth.dto.ts       MODIFY: signupDto +fields +captcha
├── modules/auth/auth.service.ts   MODIFY: signup sets names/phone, checks phone uniq + captcha
├── modules/auth/auth.controller.ts MODIFY: + getCaptcha
├── modules/auth/auth.routes.ts    MODIFY: + GET /captcha
├── modules/public/public.controller.ts  NEW: GET /public/config
├── modules/public/public.routes.ts       NEW
├── modules/analytics/analytics.dto.ts     NEW
├── modules/analytics/analytics.service.ts NEW: ingest events
├── modules/analytics/analytics.controller.ts NEW
├── modules/analytics/analytics.routes.ts  NEW: POST /track (+ optional-auth, sid cookie)
├── middleware/optional-auth.ts    NEW: attach req.auth if a valid cookie, else continue
├── modules/borrower/borrower.service.ts   MODIFY: active-application guard in applyForLoan
└── routes.ts                      MODIFY: mount public + analytics routers
```

---

## Task 1: User model — firstName, lastName, phone (unique sparse)

**Files:**
- Modify: `src/models/user.model.ts`
- Test: `tests/models/user-v2.test.ts`

**Interfaces:**
- Produces: `User` schema with `firstName?: string`, `lastName?: string`, `phone?: string` (unique sparse, match `^[6-9]\d{9}$`). `IUser` includes them.

- [ ] **Step 1: Write the failing test**

`tests/models/user-v2.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- user-v2`
Expected: FAIL (phone field/index not present).

- [ ] **Step 3: Modify `src/models/user.model.ts`**

Add inside the schema definition (alongside the existing fields):
```ts
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String, unique: true, sparse: true, match: /^[6-9]\d{9}$/ },
```
(Keep `fullName` required as-is; the new fields are optional so seeded staff remain valid.)

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test -- user-v2` then `bun run test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add firstName/lastName/unique phone to User model"
```

---

## Task 2: Captcha — model, lib, and GET /auth/captcha

**Files:**
- Create: `src/models/captcha.model.ts`, `src/lib/captcha.ts`
- Modify: `src/models/index.ts`, `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.routes.ts`
- Test: `tests/lib/captcha.test.ts`, `tests/modules/auth/captcha.int.test.ts`

**Interfaces:**
- Produces: `Captcha` model `{ answerHash, expiresAt }` (TTL index on expiresAt). `lib/captcha.ts`: `issueCaptcha(): Promise<{ captchaId, svg }>` and `verifyCaptcha(captchaId, text): Promise<boolean>` (consumes on success). `GET /api/v1/auth/captcha` → `{ captchaId, svg }`.

- [ ] **Step 1: Install svg-captcha**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun add svg-captcha
```

- [ ] **Step 2: Write the failing lib test**

`tests/lib/captcha.test.ts`:
```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../src/db/connect';
import { issueCaptcha, verifyCaptcha } from '../../src/lib/captcha';
import { Captcha } from '../../src/models/captcha.model';

let mem: MongoMemoryServer;
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('captcha', () => {
  it('issues an svg + id and verifies+consumes the answer', async () => {
    const { captchaId, svg } = await issueCaptcha();
    expect(svg).toContain('<svg');
    // read the stored answer to simulate a correct user entry (test-only introspection)
    const doc: any = await Captcha.findById(captchaId).lean();
    expect(doc).toBeTruthy();
    // wrong answer fails
    expect(await verifyCaptcha(captchaId, 'definitely-wrong')).toBe(false);
    // (doc still exists after a failed attempt)
    expect(await Captcha.findById(captchaId)).toBeTruthy();
  });
  it('returns false for unknown id', async () => {
    expect(await verifyCaptcha('64b000000000000000000000', 'x')).toBe(false);
  });
});
```
(Note: we can't read the plaintext answer because it's hashed — the int test below exercises the success path via a deterministic seam. Here we only assert failure/consume semantics.)

- [ ] **Step 3: Run to verify it fails**

Run: `bun run test -- captcha.test`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement the model + lib**

`src/models/captcha.model.ts`:
```ts
import { Schema, model, InferSchemaType, Types } from 'mongoose';
const captchaSchema = new Schema(
  {
    answerHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
// TTL: Mongo removes the doc once expiresAt passes
captchaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type ICaptcha = InferSchemaType<typeof captchaSchema> & { _id: Types.ObjectId };
export const Captcha = model('Captcha', captchaSchema);
```

`src/lib/captcha.ts`:
```ts
import svgCaptcha from 'svg-captcha';
import { createHash } from 'crypto';
import { Captcha } from '../models/captcha.model';

const TTL_MS = (Number(process.env.CAPTCHA_TTL_SECONDS) || 300) * 1000;
const norm = (s: string) => s.trim().toLowerCase();
const hash = (s: string) => createHash('sha256').update(norm(s)).digest('hex');

export async function issueCaptcha(): Promise<{ captchaId: string; svg: string }> {
  const c = svgCaptcha.create({ size: 5, noise: 2, ignoreChars: '0o1il', color: true });
  const doc = await Captcha.create({ answerHash: hash(c.text), expiresAt: new Date(Date.now() + TTL_MS) });
  return { captchaId: doc._id.toString(), svg: c.data };
}

export async function verifyCaptcha(captchaId: string, text: string): Promise<boolean> {
  if (!captchaId || !text) return false;
  const doc = await Captcha.findById(captchaId).catch(() => null);
  if (!doc) return false;
  if (doc.expiresAt.getTime() < Date.now()) return false;
  const ok = doc.answerHash === hash(text);
  if (ok) await Captcha.deleteOne({ _id: doc._id }); // one-time use: consume only on success
  return ok;
}
```

Add to `src/models/index.ts`: `export * from './captcha.model';` and `export * from './event.model';` (event added in Task 4 — add its line then too).

- [ ] **Step 5: Add the controller + route**

In `src/modules/auth/auth.controller.ts` add:
```ts
import { issueCaptcha } from '../../lib/captcha';
export async function getCaptcha(_req: Request, res: Response) {
  res.json(await issueCaptcha());
}
```
In `src/modules/auth/auth.routes.ts` add: `authRouter.get('/captcha', asyncHandler(c.getCaptcha));`

- [ ] **Step 6: Write the captcha integration test (success path)**

`tests/modules/auth/captcha.int.test.ts`:
```ts
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { Captcha } from '../../../src/models/captcha.model';
import { createHash } from 'crypto';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('GET /auth/captcha', () => {
  it('returns an svg + id', async () => {
    const res = await request(app).get('/api/v1/auth/captcha');
    expect(res.status).toBe(200);
    expect(res.body.captchaId).toBeDefined();
    expect(res.body.svg).toContain('<svg');
  });
});

// helper other tests reuse: create a captcha with a known answer
export async function makeKnownCaptcha(answer = 'abcde') {
  const doc = await Captcha.create({ answerHash: createHash('sha256').update(answer).digest('hex'), expiresAt: new Date(Date.now() + 60000) });
  return { captchaId: doc._id.toString(), captchaText: answer };
}
```

- [ ] **Step 7: Run + commit**

Run: `bun run test -- captcha` then `bun run test`
Expected: PASS; full suite green.
```bash
git add -A && git commit -m "feat: add self-hosted svg captcha (model, lib, /auth/captcha)"
```

---

## Task 3: Signup — new fields, phone uniqueness, captcha gate

**Files:**
- Modify: `src/modules/auth/auth.dto.ts`, `src/modules/auth/auth.service.ts`
- Test: `tests/modules/auth/signup-v2.int.test.ts`

**Interfaces:**
- Consumes: `verifyCaptcha`, `makeKnownCaptcha` (test helper).
- Produces: `signupDto` requires `firstName, lastName, phone, email, password, captchaId, captchaText`. `signup()` verifies captcha (422 on fail), enforces unique phone (409 `PHONE_TAKEN`), sets `fullName = firstName + ' ' + lastName`.

- [ ] **Step 1: Write the failing test**

`tests/modules/auth/signup-v2.int.test.ts`:
```ts
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { makeKnownCaptcha } from './captcha.int.test';
import { User } from '../../../src/models/user.model';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); await runSeed(); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

const base = (cap: any, over: any = {}) => ({
  firstName: 'Rahul', lastName: 'K', email: `r${Math.random()}@x.com`, phone: `9${Math.floor(100000000 + Math.random()*899999999)}`,
  password: 'Passw0rd!', ...cap, ...over,
});

describe('signup v2', () => {
  it('creates a user with names+phone and sets fullName', async () => {
    const cap = await makeKnownCaptcha();
    const res = await request(app).post('/api/v1/auth/signup').send(base(cap));
    expect(res.status).toBe(201);
    const u = await User.findOne({ email: res.body.email });
    expect(u!.fullName).toBe('Rahul K');
    expect(u!.phone).toMatch(/^[6-9]\d{9}$/);
  });
  it('rejects a wrong captcha with 422', async () => {
    const cap = await makeKnownCaptcha();
    const res = await request(app).post('/api/v1/auth/signup').send(base({ captchaId: cap.captchaId, captchaText: 'WRONG' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CAPTCHA_INVALID');
  });
  it('rejects a duplicate phone with 409', async () => {
    const phone = '9811111111';
    await request(app).post('/api/v1/auth/signup').send(base(await makeKnownCaptcha(), { phone }));
    const res = await request(app).post('/api/v1/auth/signup').send(base(await makeKnownCaptcha(), { phone }));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- signup-v2`
Expected: FAIL (dto/service don't handle new fields).

- [ ] **Step 3: Update `auth.dto.ts`**

```ts
export const signupDto = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile'),
  password: z.string().min(8).max(128),
  captchaId: z.string().min(1),
  captchaText: z.string().min(1),
});
```
(Keep `loginDto` unchanged. `confirmPassword` is validated client-side only.)

- [ ] **Step 4: Update `signup()` in `auth.service.ts`**

```ts
import { verifyCaptcha } from '../../lib/captcha';
import { ValidationError } from '../../lib/errors';

export async function signup(input: SignupInput, ip?: string) {
  if (!(await verifyCaptcha(input.captchaId, input.captchaText))) {
    throw new ValidationError('Captcha verification failed', undefined).withCode?.('CAPTCHA_INVALID') ?? new ValidationError('Captcha verification failed');
  }
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');
  if (await User.findOne({ phone: input.phone })) throw new ConflictError('Phone already registered');
  const borrowerRole = await Role.findOne({ code: 'BORROWER' });
  if (!borrowerRole) throw new Error('BORROWER role missing — run seed');
  const user = await User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: `${input.firstName} ${input.lastName}`,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    role: borrowerRole._id,
  });
  return { user, tokens: await issueTokens(user._id.toString(), ip) };
}
```
NOTE on the captcha error code: `ValidationError` currently always uses code `VALIDATION_ERROR`. To return `CAPTCHA_INVALID`, add a dedicated error or pass the code. Simplest: in `src/lib/errors.ts` add:
```ts
export class CaptchaError extends AppError {
  constructor(message = 'Captcha verification failed') { super(422, 'CAPTCHA_INVALID', message); }
}
```
and in signup throw `new CaptchaError()`. Use that (drop the `.withCode` placeholder above).

- [ ] **Step 5: Run + commit**

Run: `bun run test -- signup-v2` then `bun run test`
Expected: PASS; full suite green. (Also confirm the EXISTING `auth.int.test.ts` signup test still passes — if it sent only fullName/email/password it must be updated to the new fields + a captcha; update it to use `makeKnownCaptcha` and the new body.)
```bash
git add -A && git commit -m "feat: signup with names + unique phone + captcha gate"
```

---

## Task 4: Analytics — Event model, /track, optional-auth, sid cookie

**Files:**
- Create: `src/models/event.model.ts`, `src/middleware/optional-auth.ts`, `src/modules/analytics/*` (dto, service, controller, routes)
- Modify: `src/routes.ts` (mount), `src/models/index.ts`
- Test: `tests/modules/analytics/track.int.test.ts`

**Interfaces:**
- Produces: `Event` model `{ name, sessionId, userId?, path?, referrer?, utm?, userAgent?, ip?, ts }`. `optionalAuth` middleware (sets `req.auth` if a valid accessToken cookie exists, else continues). `POST /api/v1/track` → 202; sets a non-httpOnly `sid` cookie if absent; stores each event with the resolved sessionId + (optional) userId + ip + userAgent.

- [ ] **Step 1: Write the failing test**

`tests/modules/analytics/track.int.test.ts`:
```ts
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { Event } from '../../../src/models/event.model';

let mem: MongoMemoryServer; const app = createApp();
beforeAll(async () => { mem = await MongoMemoryServer.create(); await connectDb(mem.getUri()); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('POST /track', () => {
  it('ingests events, sets a sid cookie, returns 202', async () => {
    const res = await request(app).post('/api/v1/track').send({ events: [{ name: 'landing_view', path: '/' }] });
    expect(res.status).toBe(202);
    expect((res.headers['set-cookie'] || []).join()).toMatch(/sid=/);
    const e = await Event.findOne({ name: 'landing_view' });
    expect(e).toBeTruthy();
    expect(e!.sessionId).toBeTruthy();
  });
  it('reuses an existing sid cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/track').send({ events: [{ name: 'page_view', path: '/a' }] });
    await agent.post('/api/v1/track').send({ events: [{ name: 'page_view', path: '/b' }] });
    const sids = await Event.find({ name: 'page_view' }).distinct('sessionId');
    expect(sids.length).toBe(1); // same session across both calls
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- track.int`
Expected: FAIL.

- [ ] **Step 3: Implement the model**

`src/models/event.model.ts`:
```ts
import { Schema, model, InferSchemaType, Types } from 'mongoose';
const eventSchema = new Schema(
  {
    name: { type: String, required: true },
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    path: String,
    referrer: String,
    utm: { source: String, medium: String, campaign: String },
    userAgent: String,
    ip: String,
    ts: { type: Date, required: true },
  },
  { timestamps: true },
);
eventSchema.index({ name: 1, ts: -1 });
export type IEvent = InferSchemaType<typeof eventSchema> & { _id: Types.ObjectId };
export const Event = model('Event', eventSchema);
```

- [ ] **Step 4: Implement optional-auth + analytics module**

`src/middleware/optional-auth.ts`:
```ts
import { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { User } from '../models/user.model';

// like authenticate, but never rejects — used so /track can attach userId when present
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      const { sub } = verifyAccessToken(token);
      const user = await User.findById(sub);
      if (user && user.status === 'active') req.auth = { user: user as any, permissions: new Set() };
    }
  } catch {
    /* ignore — anonymous */
  }
  next();
};
```

`src/modules/analytics/analytics.dto.ts`:
```ts
import { z } from 'zod';
export const trackDto = z.object({
  events: z.array(z.object({
    name: z.string().min(1).max(64),
    path: z.string().max(512).optional(),
    referrer: z.string().max(512).optional(),
    utm: z.object({ source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional() }).optional(),
    ts: z.coerce.date().optional(),
  })).min(1).max(50),
});
```

`src/modules/analytics/analytics.service.ts`:
```ts
import { Types } from 'mongoose';
import { Event } from '../../models/event.model';

export async function ingestEvents(params: {
  events: { name: string; path?: string; referrer?: string; utm?: any; ts?: Date }[];
  sessionId: string; userId?: string; userAgent?: string; ip?: string;
}) {
  const docs = params.events.map((e) => ({
    name: e.name, path: e.path, referrer: e.referrer, utm: e.utm,
    sessionId: params.sessionId,
    userId: params.userId ? new Types.ObjectId(params.userId) : undefined,
    userAgent: params.userAgent, ip: params.ip, ts: e.ts ?? new Date(),
  }));
  await Event.insertMany(docs, { ordered: false });
}
```

`src/modules/analytics/analytics.controller.ts`:
```ts
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ingestEvents } from './analytics.service';
import { config } from '../../config';

export async function track(req: Request, res: Response) {
  let sid = req.cookies?.sid as string | undefined;
  if (!sid) {
    sid = randomUUID();
    res.cookie('sid', sid, { httpOnly: false, secure: config.cookie.secure, sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
  }
  // fire-and-forget: never block the client
  ingestEvents({
    events: req.body.events,
    sessionId: sid,
    userId: req.auth?.user?._id?.toString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  }).catch(() => {});
  res.status(202).json({ ok: true });
}
```

`src/modules/analytics/analytics.routes.ts`:
```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../middleware/async-handler';
import { optionalAuth } from '../../middleware/optional-auth';
import { validate } from '../../middleware/validate';
import { trackDto } from './analytics.dto';
import * as c from './analytics.controller';

export const analyticsRouter = Router();
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
analyticsRouter.post('/', trackLimiter, optionalAuth, validate({ body: trackDto }), asyncHandler(c.track));
```

Mount in `src/routes.ts`: `import { analyticsRouter } from './modules/analytics/analytics.routes'; apiRouter.use('/track', analyticsRouter);`

- [ ] **Step 5: Run + commit**

Run: `bun run test -- track.int` then `bun run test`
Expected: PASS; full suite green.
```bash
git add -A && git commit -m "feat: first-party analytics ingest (/track, events, sid cookie, optional-auth)"
```

---

## Task 5: Public config endpoint

**Files:**
- Create: `src/modules/public/public.controller.ts`, `src/modules/public/public.routes.ts`
- Modify: `src/routes.ts`
- Test: `tests/modules/public/config.int.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/public/config` (no auth) → `{ loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: 12, minTenureDays: 30, maxTenureDays: 365 }, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried','Self-Employed'] } }` (rupees + the BRE constants).

- [ ] **Step 1: Write the failing test**

`tests/modules/public/config.int.test.ts`:
```ts
import request from 'supertest';
import { createApp } from '../../../src/app';
const app = createApp();
describe('GET /public/config', () => {
  it('returns loan params + eligibility', async () => {
    const res = await request(app).get('/api/v1/public/config');
    expect(res.status).toBe(200);
    expect(res.body.loan.interestRate).toBe(12);
    expect(res.body.loan.minPrincipal).toBe(50000);
    expect(res.body.eligibility.minAge).toBe(23);
    expect(res.body.eligibility.minMonthlySalary).toBe(25000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- config.int`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/modules/public/public.controller.ts`:
```ts
import { Request, Response } from 'express';
import { INTEREST_RATE } from '../../lib/loan-math';

export function getPublicConfig(_req: Request, res: Response) {
  res.json({
    loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: INTEREST_RATE, minTenureDays: 30, maxTenureDays: 365 },
    eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried', 'Self-Employed'] },
  });
}
```

`src/modules/public/public.routes.ts`:
```ts
import { Router } from 'express';
import { getPublicConfig } from './public.controller';
export const publicRouter = Router();
publicRouter.get('/config', getPublicConfig);
```

Mount in `src/routes.ts`: `import { publicRouter } from './modules/public/public.routes'; apiRouter.use('/public', publicRouter);`

- [ ] **Step 4: Run + commit**

Run: `bun run test -- config.int` then `bun run test`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add public /config endpoint for the landing page"
```

---

## Task 6: One active application rule

**Files:**
- Modify: `src/modules/borrower/borrower.service.ts` (`applyForLoan`)
- Test: `tests/modules/borrower/active-application.int.test.ts` (uses `MongoMemoryReplSet` — apply is transactional)

**Interfaces:**
- Produces: `applyForLoan` throws `ConflictError('You already have an application in progress')` with `details: { loanRef }` (code 409) when the borrower has a loan in `APPLIED|SANCTIONED|DISBURSED`.

- [ ] **Step 1: Write the failing test**

`tests/modules/borrower/active-application.int.test.ts`:
```ts
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDb, disconnectDb } from '../../../src/db/connect';
import { createApp } from '../../../src/app';
import { runSeed } from '../../../src/seed/seed';
import { makeKnownCaptcha } from '../auth/captcha.int.test';

jest.mock('../../../src/lib/storage', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('http://minio/u'), getDownloadUrl: jest.fn().mockResolvedValue('http://minio/d'),
}));

let mem: MongoMemoryReplSet; const app = createApp();
async function readyBorrower() {
  const agent = request.agent(app);
  const cap = await makeKnownCaptcha();
  await agent.post('/api/v1/auth/signup').send({ firstName: 'B', lastName: 'X', email: `b${Math.random()}@x.com`, phone: `9${Math.floor(100000000+Math.random()*899999999)}`, password: 'Passw0rd!', ...cap });
  await agent.put('/api/v1/borrower/profile').send({ fullName: 'B X', pan: 'ABCDE1234F', dob: '1995-04-12', monthlySalary: 45000, employmentMode: 'Salaried' });
  const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
  return agent;
}
beforeAll(async () => { mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await connectDb(mem.getUri()); await runSeed(); });
afterAll(async () => { await disconnectDb(); await mem.stop(); });

describe('one active application', () => {
  it('blocks a second apply while one is active (409)', async () => {
    const agent = await readyBorrower();
    const first = await agent.post('/api/v1/borrower/loans').send({ principal: 200000, tenureDays: 60 });
    expect(first.status).toBe(201);
    // re-stage a slip then try again (profile slip was consumed on apply)
    const pre = await agent.post('/api/v1/borrower/salary-slip/presign').send({ filename: 's.pdf', mime: 'application/pdf', size: 1000 });
    await agent.put('/api/v1/borrower/salary-slip').send({ objectKey: pre.body.objectKey, filename: 's.pdf', mime: 'application/pdf', size: 1000 });
    const second = await agent.post('/api/v1/borrower/loans').send({ principal: 100000, tenureDays: 90 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
    expect(second.body.error.details.loanRef).toMatch(/^LMS-/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- active-application`
Expected: FAIL (second apply currently succeeds).

- [ ] **Step 3: Add the guard in `applyForLoan`**

Inside the `session.withTransaction` block of `applyForLoan`, BEFORE generating the loanRef / creating the loan (and after re-reading the profile), add:
```ts
const active = await Loan.findOne(
  { borrower: new Types.ObjectId(userId), status: { $in: ['APPLIED', 'SANCTIONED', 'DISBURSED'] } },
  null,
  { session },
);
if (active) {
  throw new ConflictError('You already have an application in progress', { loanRef: active.loanRef });
}
```
(`ConflictError` already accepts a `details` second arg.)

- [ ] **Step 4: Run + commit**

Run: `bun run test -- active-application` then full `bun run test` (run the replica-set suites as separate commands, not chained).
Expected: PASS; full suite green.
```bash
git add -A && git commit -m "feat: enforce one active application per borrower (409)"
```

---

## Task 7: Wire deps into Docker + full verification

**Files:**
- Modify: `README.md` (note new endpoints + CAPTCHA_TTL_SECONDS optional), `.env.example` (optional `CAPTCHA_TTL_SECONDS=300`)

- [ ] **Step 1: Confirm svg-captcha is in package.json deps**

Run: `grep svg-captcha package.json` → present (added in Task 2). `bun.lock` updated.

- [ ] **Step 2: Full suite + lint**

Run: `bun run test` then `bun run lint`
Expected: all green; lint 0 errors.

- [ ] **Step 3: Document + commit**

Add to `.env.example`: `CAPTCHA_TTL_SECONDS=300` (optional). Note the new endpoints in `README.md` API summary (`GET /auth/captcha`, `GET /public/config`, `POST /track`; signup new fields; apply 409 rule).
```bash
git add -A && git commit -m "docs: document v2 endpoints + optional CAPTCHA_TTL_SECONDS"
```

---

## Self-Review

**1. Spec coverage:** User fields (Task 1) ✓ · captcha model/lib/endpoint (Task 2) + signup gate (Task 3) ✓ · phone unique (Tasks 1,3) ✓ · analytics events/track/sid/optional-auth (Task 4) ✓ · public config (Task 5) ✓ · one-active-application rule (Task 6) ✓ · docker/env (Task 7) ✓. `fullName` derived (Task 3) ✓.

**2. Placeholder scan:** Task 3 Step 4 shows a `.withCode?` placeholder then immediately corrects it with a concrete `CaptchaError` class — use the `CaptchaError`. No other TODO/TBD.

**3. Type consistency:** `verifyCaptcha(captchaId, text)` consistent (Tasks 2,3). `makeKnownCaptcha` exported from `captcha.int.test.ts`, imported by signup-v2 + active-application tests. `ConflictError(message, details?)` matches existing signature (Task 6). `req.auth` shape `{ user, permissions: Set }` matches the existing augmentation (Task 4 optional-auth). Event field names consistent (Task 4). `INTEREST_RATE` imported from `lib/loan-math` (Task 5) matches the existing export.

**Note:** the existing `auth.int.test.ts` signup test MUST be updated in Task 3 to send the new signup body (names + phone + captcha) or it will fail — Task 3 Step 5 calls this out.
