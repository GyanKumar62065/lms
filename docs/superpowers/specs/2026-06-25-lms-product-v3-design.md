# LMS Product v3 — Loan Products + Admin Dashboard (Design Spec)

**Date:** 2026-06-25
**Builds on:** v1 (core LMS), v2 (landing/registration/captcha/analytics/one-application rule)
**Status:** Approved for implementation

## Goal

Two related capabilities:

1. **Loan Products (admin-posted catalog).** Admins create loan *products* (named offerings with their own interest rate, principal/tenure bounds, and eligibility rules). Borrowers browse active products and apply *against a chosen product*. The application is validated against that product's rules, and the granted terms are **snapshotted** onto the loan.
2. **Admin Portfolio Dashboard.** An admin overview with KPI cards, charts, a per-product performance breakdown, a filterable loans list, and a per-loan audit-trail detail page.

Part A is the foundation (all Part B metrics group by product), so it is built first.

---

## Global Constraints

- **Money:** integer **paise** in DB and all internal math. APIs accept/return **rupees** at the edge and convert via `rupeesToPaise`/`paiseToRupees` (`src/lib/money.ts`). Product bounds stored as paise; product DTOs accept rupees.
- **Tooling:** **Bun** everywhere (`bun install`, `bun add`, `bunx`, `bun run <script>`). Tests via `bun run test` (never `bun test`). Node 20 on PATH (`/Users/gyankumar/.nvm/versions/node/v20.20.2/bin`).
- **Backend stack:** Express 4, Mongoose 8, MongoDB 7 (replica set for transactions), zod 3, Jest + ts-jest + supertest + mongodb-memory-server (ReplSet). All models registered in `src/models/index.ts` barrel; `import './models'` stays in `app.ts`.
- **Frontend stack:** Next 16 App Router (`cookies()`/`headers()` async; `useSearchParams` needs Suspense), TS strict, Tailwind, shadcn-on-**@base-ui** (NO `asChild`/Slot → use `<Link className={buttonVariants()}>`; Slider takes **array** value; Dialog uses `render` prop), react-hook-form + zod, lucide-react, sonner, Vitest + RTL. Frontend on **port 3100**.
- **Charts:** add **Recharts**. Colors from the existing `--chart-1`…`--chart-5` oklch tokens in `globals.css`. No other chart lib.
- **RBAC pattern unchanged:** permissions seeded in `src/seed/definitions/permissions.ts`, roles in `roles.ts`; routes gated by `authorize('<perm>')`. Frontend gates via `requirePermission` (`src/lib/auth/session.ts`) and sidebar filters by `permissions.includes(perm)`.
- **Backwards compatibility:** existing v1/v2 endpoints and tests keep working. `GET /public/config` is retained. Existing loans without a product stay valid (`product` is required only for *new* applications).
- **Loan ref format** unchanged: `LMS-<year>-<6-digit-seq>`.

---

## PART A — Loan Products

### A1. `LoanProduct` model

New model `src/models/loan-product.model.ts`, registered in the barrel.

```
LoanProduct {
  code: string            // unique, uppercase slug, e.g. 'PERSONAL', 'SALARY_ADVANCE'
  name: string            // display name
  description: string     // shown to borrower
  interestRate: number    // % per annum (same convention as v1 INTEREST_RATE)
  minPrincipal: number    // paise
  maxPrincipal: number    // paise  (>= minPrincipal)
  minTenureDays: number
  maxTenureDays: number   // (>= minTenureDays)
  eligibility: {
    minAge: number
    maxAge: number              // (>= minAge)
    minMonthlySalary: number    // paise
    employmentModes: string[]   // subset of ['Salaried','Self-Employed','Unemployed']
  }
  status: 'ACTIVE' | 'INACTIVE'   // default 'ACTIVE'
  createdAt, updatedAt
}
```

Index: `code` unique. Validation invariants (min ≤ max for principal, tenure, age; non-empty employmentModes; rate ≥ 0) enforced at the DTO layer (zod `.refine`) and mirrored in schema where cheap.

### A2. Seed starter catalog

In `src/seed/definitions/`, add `products.ts` and upsert in `seed.ts` (upsert by `code`, like roles/permissions — never overwrite admin edits on re-seed; only insert if absent). Two products that preserve current behavior plus one distinct offering:

- **PERSONAL** — "Personal Loan", 12% p.a., principal ₹50,000–₹5,00,000, tenure 30–365 days, eligibility {minAge 23, maxAge 50, minMonthlySalary ₹25,000, employmentModes ['Salaried','Self-Employed']}. (Matches today's global config exactly.)
- **SALARY_ADVANCE** — "Salary Advance", 18% p.a., principal ₹10,000–₹1,00,000, tenure 7–60 days, eligibility {minAge 21, maxAge 55, minMonthlySalary ₹15,000, employmentModes ['Salaried']}.

### A3. RBAC additions

Add to `permissions.ts`:
- `product:read` — view all products incl. INACTIVE (module 'products').
- `product:manage` — create/edit/activate/deactivate products (module 'products').
- `metrics:read` — view admin dashboard metrics (module 'admin'). *(used by Part B)*

Role mapping (`roles.ts`):
- **ADMIN** gains `product:read`, `product:manage`, `metrics:read`.
- **SALES, SANCTION, DISBURSEMENT, COLLECTION** gain `product:read` (read-only product visibility).
- **BORROWER** gets no product permission (browses via public catalog).

### A4. Term snapshot on `Loan`

Extend `loan.model.ts`:
- `product: { type: ObjectId, ref: 'LoanProduct' }` — required on new loans (kept optional in schema so legacy loans validate; required enforced in `applyForLoan`).
- `productCode: string`, `productName: string` — denormalized snapshot for display/audit.
- `interestRate` already exists → set to the **product's rate at apply time** (no longer the global constant).

Editing a product later never mutates existing loans: terms are copied at apply time.

### A5. Parameterize math & eligibility (minimal blast radius)

- `src/lib/loan-math.ts`: `computeSimpleInterest(principalPaise, tenureDays, rate = INTEREST_RATE)` and `computeRepayment(principalPaise, tenureDays, rate = INTEREST_RATE)` gain an optional `rate` param defaulting to the global constant. Existing callers unaffected; `applyForLoan` passes the product rate.
- `src/lib/bre.ts`: `evaluateBre` gains an optional `thresholds` arg `{ minAge, maxAge, minMonthlySalaryPaise, employmentModes }` defaulting to the existing global constants. **Profile upsert keeps using defaults** (preserving the lead `BRE_REJECTED` stage and existing tests). `applyForLoan` calls `evaluateBre(..., productThresholds)` for the **product-specific** gate.

### A6. `applyForLoan` changes (`src/modules/borrower/borrower.service.ts`)

New signature: `applyForLoan(userId, { productCode: string, principal: number /*rupees*/, tenureDays: number })`.

Inside the existing transaction, in order:
1. Load the product by `code` with `status: 'ACTIVE'`; 404 `PRODUCT_NOT_FOUND` if missing/inactive.
2. Validate `principal` (paise) within `[minPrincipal, maxPrincipal]` and `tenureDays` within `[minTenureDays, maxTenureDays]`; else 422 `PRODUCT_BOUNDS` with the allowed range in `details`.
3. Profile must exist and have a staged `pendingSalarySlip` (unchanged checks).
4. **Product eligibility:** `evaluateBre({pan,dob,monthlySalaryPaise,employmentMode}, productThresholds)`; if `!passed` → 422 `PRODUCT_ELIGIBILITY_FAILED` with `failedRules`.
5. **Per-product one-active guard:** `Loan.findOne({ borrower, product: product._id, status: { $in: ['APPLIED','SANCTIONED','DISBURSED'] } }, null, { session })`; if found → 409 `ACTIVE_APPLICATION_EXISTS` with `{ loanRef, productCode }`.
6. Compute repayment with the product rate; create the loan with `product`, `productCode`, `productName`, `interestRate = product.interestRate`, and the term snapshot; `statusHistory` seeded as today.
7. Clear `pendingSalarySlip` (unchanged).

DTO (`borrower.dto.ts`): `applyDto` adds `productCode: z.string().min(1)`; principal/tenure bounds become looser superset checks (real bounds validated against the product) — keep a sane outer guard (e.g. principal 1k–10L) so obviously bad input is rejected pre-DB.

### A7. Products module (`src/modules/products/`)

`product.model` lives under `src/models`; the module holds controller/service/routes/dto.

- `GET /api/v1/public/products` — **no auth**, returns ACTIVE products, rupee-denominated, sorted by name. (Add to `public` router or a small public products handler; reuse the same serializer.)
- `GET /api/v1/products` — `authorize('product:read')`, returns **all** products (incl. INACTIVE) for ops/admin.
- `GET /api/v1/products/:code` — `authorize('product:read')`, single product or 404.
- `POST /api/v1/admin/products` — `authorize('product:manage')`, create (rupees in → paise stored); 409 `PRODUCT_CODE_EXISTS` on duplicate code.
- `PATCH /api/v1/admin/products/:id` — `authorize('product:manage')`, partial update (all fields except `code` editable; code immutable).
- `POST /api/v1/admin/products/:id/activate` and `/deactivate` — `authorize('product:manage')`, flip `status`.

Serializer converts paise→rupees for `minPrincipal`/`maxPrincipal`/`eligibility.minMonthlySalary` on the way out.

### A8. Frontend — Part A

- **Types** (`src/types/api.ts`): add `LoanProduct` (rupee-denominated, matching the serializer) and `ProductEligibility`.
- **Endpoints** (`src/lib/api/endpoints.ts`): `publicProducts()`, `products()`, `product(code)`, `createProduct(b)`, `updateProduct(id,b)`, `activateProduct(id)`, `deactivateProduct(id)`. `apply()` body gains `productCode`.
- **Borrower catalog** — new portal page `src/app/(portal)/products/page.tsx` (server, async): fetch active products, render cards (name, rate, principal range, tenure range, "Apply" → `/apply?product=<code>`). If a profile exists, annotate each card eligible/ineligible (evaluate client-side or via a lightweight check) — *nice-to-have, not blocking*.
- **Apply wizard** (`src/components/wizard/apply-wizard.tsx`, `step-config.tsx`): read `?product=<code>` (Suspense-wrapped `useSearchParams`); if absent, show a product picker first. `StepConfig` bounds (principal/tenure sliders) and the displayed rate come from the **selected product**, not hardcoded. `calcRepayment` uses the product rate. `endpoints.apply` sends `productCode`. The apply page's blocked-state becomes **per product** (only block if an active loan exists for the chosen product).
- **Marketing landing**: `EstimateWidget` lets the visitor pick a product (dropdown) and estimates against its rate/bounds; product cards link into the apply flow. Keep `/public/config` fallback so the page never hard-fails.
- **Admin products screen** — new dashboard page `src/app/(dashboard)/admin/products/page.tsx` (gated `product:manage`): table of all products with status badges + activate/deactivate, and a create/edit dialog (Dialog `render` prop) using react-hook-form + zod. Add to sidebar (`Icon: Package`, perm `product:manage`).

---

## PART B — Admin Portfolio Dashboard

### B1. Metrics aggregation (`src/modules/metrics/`)

`GET /api/v1/admin/metrics` — `authorize('metrics:read')`. One response assembled via MongoDB aggregation pipelines (rupee-denominated at the edge):

```
{
  kpis: {
    totalDisbursed,        // Σ principal where status in [DISBURSED, CLOSED]
    totalRecovered,        // Σ amountPaid (all loans)
    outstandingBook,       // Σ outstanding where status = DISBURSED
    activeLoans,           // count status = DISBURSED
    totalApplications,     // count all loans
    approvalRate,          // (SANCTIONED+DISBURSED+CLOSED) / decided, decided = all except APPLIED
    rejectedCount, rejectionRate,
    avgTicketSize          // mean principal where status in [DISBURSED, CLOSED]
  },
  byStatus: [{ status, count }],                 // for donut
  funnel: { applied, sanctioned, disbursed, closed, rejected },
  timeSeries: [{ month: 'YYYY-MM', disbursed, recovered }],   // last 12 months
  byProduct: [{ productCode, productName, applicants, borrowed, recovered, outstanding, active, rejected, approvalRate }]
}
```

Use `$facet` to compute the sections in one round-trip where practical. `applicants` = count of loans for that product; `borrowed` = Σ principal of disbursed/closed for that product; etc.

### B2. Loans list filters (extend `src/modules/loans/`)

Extend the existing `GET /api/v1/loans` (`loan:read:all`) query DTO to accept: `status`, `productCode`, `from`/`to` (createdAt range), `q` (matches loanRef, borrower fullName/email — via `$lookup` or pre-resolved borrower ids), `minAmount`/`maxAmount` (rupees, on principal), `sort` (e.g. `-createdAt`, `principal`), plus existing `page`/`limit`. Borrower populated with `fullName`/`email`. Keep response shape `Paginated<Loan>`.

### B3. Loan detail + audit trail

`GET /api/v1/loans/:id` (`loan:read:all`) returns the loan with `borrower` populated, its `payments` (sorted), and an assembled **timeline** array:

```
timeline: [{ type, at, actor: { id, name } | null, detail }]
```
built from `statusHistory` (each transition with `by`+`reason`), `sanction`, `disbursement`, and payment docs (UTR, amount, recordedBy). Sorted ascending by `at`. No new collection — derived at read time.

### B4. Frontend — Part B

- **Endpoints:** `adminMetrics()`, extend `loans()` to pass filter params, `loanDetail(id)` (with timeline + payments).
- **Recharts setup:** `bun add recharts`. Add a thin `src/components/ui/chart.tsx` wrapper (ResponsiveContainer + theme colors from `--chart-*`) or per-chart components under `src/components/dashboard/charts/`.
- **Overview page** — `src/app/(dashboard)/admin/overview/page.tsx` (server, async, gated `metrics:read`): KPI cards (use `Card`, lucide icons, `MoneyText`), funnel (bar), status donut (pie), disbursed-vs-recovered time series (bar/line), per-product grouped bars + the per-product table. Add to sidebar (`Icon: LayoutDashboard`, perm `metrics:read`), placed first.
- **Loans list page** — `src/app/(dashboard)/admin/loans/page.tsx` (gated `loan:read:all`): filter bar (status Select, product Select, date range inputs, search input, amount range), `LoansTable` (extend columns: add Product, Outstanding, Disbursed date), pagination controls. Filters drive query params → server refetch. Row → detail.
- **Loan detail page** — `src/app/(dashboard)/admin/loans/[id]/page.tsx`: borrower + product + terms cards, payments list, and the audit **timeline** rendered with the existing `LoanTimeline` common component (extended to show actor + payment entries).

---

## Error Handling

New error codes (all via existing `AppError` subclasses in `src/lib/errors.ts`):
- `PRODUCT_NOT_FOUND` (404) — product code missing or inactive at apply.
- `PRODUCT_BOUNDS` (422) — principal/tenure outside the product's range; `details` carries allowed range.
- `PRODUCT_ELIGIBILITY_FAILED` (422) — `details.failedRules`.
- `ACTIVE_APPLICATION_EXISTS` (409) — reuse existing ConflictError; `details: { loanRef, productCode }`.
- `PRODUCT_CODE_EXISTS` (409) — duplicate code on create.
Validation failures continue to flow through the `validate` middleware → 422.

## Testing

**Backend (Jest + supertest + in-memory ReplSet):**
- Product model/DTO invariants (min≤max, employmentModes non-empty, code uppercase/unique).
- Product CRUD + RBAC: `product:manage` required for write (ops get 403), `product:read` for the authed list, public list returns only ACTIVE.
- Apply-against-product: bounds rejection (422 `PRODUCT_BOUNDS`), product eligibility rejection (422 `PRODUCT_ELIGIBILITY_FAILED`), success snapshots rate/code/name, **per-product** one-active guard (two different products allowed; same product blocked), re-apply allowed after REJECTED/CLOSED.
- Snapshot immutability: apply, then edit the product's rate, assert the existing loan's `interestRate` unchanged.
- Metrics aggregation: seed a known set of loans/payments, assert each KPI, funnel, byStatus, byProduct numbers; `metrics:read` gating.
- Loans list filters: status/product/date/search/amount/sort/pagination each filter correctly.
- Loan detail timeline: ordering and actor attribution across applied→sanction→disburse→payments→closed.
- Update the shared apply test helpers to pass `productCode` (seed a product in the suites that apply), mirroring the v2 `signupBorrower` cascade lesson — one shared helper, update once.

**Frontend (Vitest + RTL):**
- Product catalog renders cards from products; "Apply" routes to `/apply?product=<code>`.
- Apply wizard: bounds/rate driven by the selected product; missing product shows picker.
- Admin products screen: create/edit dialog validates; activate/deactivate calls endpoints.
- Overview: KPI cards render from a mocked metrics payload; charts mount (mock Recharts/ResponsiveContainer); per-product table rows.
- Loans list: filter controls update query; table renders product/outstanding columns.
- Loan detail: timeline renders actor + payment entries in order.

**Live E2E (after both parts):** full Docker run on :3100 like v1/v2 — admin creates a product → borrower sees it in catalog → applies against it → bounds/eligibility enforced → per-product one-active rule → sanction→disburse→pay→close → admin overview KPIs/charts reflect the activity → loans list filters → loan detail timeline shows the full audit trail.

## Build Order

1. **Part A backend** (model, seed, RBAC, math/BRE params, applyForLoan, products module, tests).
2. **Part A frontend** (types, endpoints, catalog, apply wizard product step, admin products screen, marketing widget, tests).
3. **Part B backend** (metrics aggregation, loans list filters, loan detail timeline, tests).
4. **Part B frontend** (Recharts, overview, loans list, loan detail, tests).
5. **Live E2E** + final report.

Each part: subagent-driven implement → review → fix → green tests, then the next.
