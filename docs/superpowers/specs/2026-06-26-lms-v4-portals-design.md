# LMS v4 — Portal Separation, Borrower Journey, Operations Console (Design Spec)

**Date:** 2026-06-26
**Builds on:** v1 (core LMS), v2 (landing/registration/captcha/analytics/one-application), v3 (loan products + admin dashboard)
**Status:** Approved for spec; build after user review.

## Goal

Restructure the app into two cleanly separated experiences chosen by role at login — a **Borrower Portal** and an **Operations Portal** — and deepen the borrower journey (product browsing → detail → guarded apply → tracking → cancel) and the operations console (collapsible nav, role-scoped work queues, audit trail), while removing leftover scaffolding ("Welcome" page, "LMS Ops" branding).

## Terminology

- **Loan Product** — an admin-published offering (Personal Loan, Salary Advance…). What a borrower browses, opens for details, and applies against.
- **Application / Loan** — a borrower's actual request moving APPLIED → SANCTIONED → DISBURSED → CLOSED (or REJECTED / **CANCELLED**). What a borrower tracks and can cancel.

---

## Global Constraints

- **Stack unchanged:** Bun everywhere; backend Express/Mongoose/MongoDB (replica set), zod, Jest+supertest+in-memory ReplSet; frontend Next 16 App Router (async `cookies()`/`params`/`searchParams`; `useSearchParams` needs Suspense), TS strict, Tailwind, shadcn-on-@base-ui (NO `asChild`; Slider array value; Dialog `render` prop; base-ui Select), lucide-react, sonner, Recharts, Vitest+RTL. Frontend on **port 3100**.
- **Money:** integer paise internally; rupees at API edges. Frontend: `formatRupees` expects PAISE, `formatRupeesAmount` expects RUPEES; product/metrics/payment amounts are rupees, loan fields are paise.
- **Models barrel** + `import './models'` stay. RBAC via seeded permissions + `authorize('<perm>')`; frontend `requirePermission`.
- **Backwards-compatible:** all existing v1–v3 endpoints/tests keep working; existing data stays valid.
- **No new roles or permissions are required by default** — reuse existing ones; only add a permission if a section genuinely needs a new gate (see Phase 1).

---

## PART 1 (Phase 1) — Backend

### 1.1 Cancel a loan (`CANCELLED` status)

- Add `CANCELLED` to the Loan `status` enum and the state machine.
- New transition `CANCEL`: allowed from `APPLIED` and `SANCTIONED` (i.e. any time **before** `DISBURSED`); illegal from `DISBURSED`/`CLOSED`/`REJECTED`/already-`CANCELLED` (→ 409 ConflictError, reusing the state-machine's `Cannot CANCEL a loan in status X`).
- Endpoint: `POST /api/v1/borrower/loans/:id/cancel` — borrower-only, gated by ownership (the loan's `borrower` must equal the caller); a borrower cancelling someone else's loan → 404 (don't leak existence). Records a `statusHistory` entry `{from, to:'CANCELLED', by, reason?, at}` (optional reason from body).
- Admin path: `POST /api/v1/loans/:id/cancel` gated `loan:sanction` (admin/ops) for cancelling on a borrower's behalf, same state rules. (Admin already holds `loan:sanction`.)
- **One-active-per-product interaction:** a `CANCELLED` loan is NOT active, so the borrower may re-apply for that product after cancelling (the existing guard already only blocks `APPLIED/SANCTIONED/DISBURSED`).
- **Metrics/lists:** `CANCELLED` appears in `byStatus`, is excluded from `activeLoans`/`outstandingBook`, and is part of `decided` for approval-rate math? — **No:** keep `decided = all except APPLIED and CANCELLED` (a cancelled application was never decided by ops). Update approvalRate/rejectionRate denominators accordingly and add a test.

### 1.2 Sales lead stages (reuse + extend)

The leads module already derives a borrower's `stage` (REGISTERED → DETAILS_SUBMITTED → BRE_REJECTED → SLIP_UPLOADED). Extend the derivation so Sales can see the full funnel including drop-off:
- `REGISTERED` — signed up, no profile yet.
- `DETAILS_SUBMITTED` — profile saved, BRE passed, no slip staged.
- `BRE_REJECTED` — profile saved, BRE failed.
- `SLIP_UPLOADED` — slip staged, **not yet applied** (started apply, dropped off).
- `APPLIED` — has at least one loan in APPLIED/SANCTIONED/DISBURSED/CLOSED (converted).
- (CANCELLED-only borrowers count as a drop-off variant — surface as `APPLIED` historically but show their latest loan status.)
- Add a `stage` filter to `GET /leads` so Sales can slice by funnel position (e.g. registered-not-applied, slip-uploaded-not-applied). Keep response shape `Paginated<Lead>`; add the filter + tests.

### 1.3 Login routing signal

No backend change needed beyond what exists: `GET /auth/me` already returns `role.code` and `permissions`. The frontend uses `role.code` (BORROWER vs ops) to route. (Confirm `me` includes `role.code`; it does.)

---

## PART 2 (Phase 2) — Borrower Portal

Route group `(borrower)` (rename/repurpose the current `(marketing)` + `(portal)` groups into one coherent borrower experience). Borrower-only; an ops user who lands here is redirected to the operations portal.

### 2.1 Landing (public, `/`)
- Existing hero/landing content, **plus a carousel of active loan products** (max 5; pulls `GET /public/products`). Each carousel item shows name, rate, amount range; clicking opens the product detail page. A **"See more loans"** control → `/products`.
- Public estimate widget stays.
- CTAs (Apply / enquiry) are **auth-guarded** (see 2.4).

### 2.2 Catalog (`/products`, public)
- All active products as **cards** (name, category, rate, amount range, tenure). Each card: an **Apply** button (→ guarded apply for that product) and a clickable **card body** → product detail page.

### 2.3 Product detail (`/products/[code]`, public)
- Full offering: name, **category**, maximum amount, **eligibility criteria** (age, salary, employment), tenure range, interest rate, **live repayment calculator** (principal/tenure sliders bounded by the product → live total via `calcRepayment` at the product rate), description, and any other product fields.
- An **Apply** button on the detail page (guarded).
- (Requires a product `category` and `description` to be first-class — `description` already exists; add an optional `category` string to the product model/DTO/serializer in Phase 1, defaulting sensibly, so the detail page has it.)

### 2.4 Auth-guarded actions
- Any operational action (Apply, enquiry) requires a logged-in **borrower**. Anonymous → routed to login/register with a `next` that returns them **into the apply flow for the chosen product** (`/apply?product=<code>`), exactly as v3's smart CTA already does — extend it to cover the detail-page and carousel CTAs.

### 2.5 My Loans / tracking (`/my-loans`, borrower)
- Borrower's applications with status badges and the audit timeline per loan (reuse the timeline).
- **Cancel** action on any loan in `APPLIED`/`SANCTIONED` → confirm dialog → `POST /borrower/loans/:id/cancel` → status flips to `CANCELLED`; disabled once `DISBURSED`.

### 2.6 Logout
- Visible **logout** control in the borrower top bar → clears session → returns to landing.

## PART 3 (Phase 3) — Operations Portal

Route group `(ops)` (repurpose `(dashboard)`). Ops roles only; a borrower who lands here is redirected to the borrower portal.

### 3.1 Collapsible sidebar
- Left sidebar that **collapses**: expanded = icon + label; collapsed = **icons only** (tooltip on hover). Collapse state persists (localStorage). Replaces the current fixed sidebar.
- **Remove** the "LMS Ops" wordmark/branding; use a neutral product mark or none per the existing palette.

### 3.2 Remove the Welcome page
- Delete the `/dashboard` welcome blurb. After login, an ops user lands on a **useful default** — the **Overview** (admin/metrics:read) if permitted, else their primary work queue (Sales→leads, Sanction→sanction queue, etc.). Routing picks the first section the user's permissions allow.

### 3.3 Role-scoped sections (work queues)
Each is a filtered view over the loan lifecycle:
- **Sales** (`lead:read`) — leads with the funnel stages from 1.2; filter by stage (registered-not-applied, slip-uploaded-not-applied = drop-offs); mark-contacted stays.
- **Sanction** (`loan:sanction`) — `APPLIED` loans; approve / reject (+ now **cancel** via admin path if applicable).
- **Disbursement** (`loan:disburse`) — `SANCTIONED` loans; disburse.
- **Collection** (`payment:create`) — `DISBURSED` loans; record payments.
- **Products** (`product:manage`) — publish/manage offerings (existing admin products screen; add the new `category` field to the form).
- **Roles** (`rbac:read`) — as-is.
- **Overview** (`metrics:read`) — existing dashboard.
- **Loans** (`loan:read:all`) — existing filterable list + loan detail with **audit trail** (already built; ensure CANCELLED renders).

### 3.4 Audit trail
- Every loan detail (ops side) shows the full **audit trail**: each event with timestamp, actor, action, reason — already implemented in v3's loan-detail timeline; extend to include the CANCEL event and ensure it is reachable from every ops queue (row → detail).

---

## Architecture & Boundaries

- **One Next.js app, two route groups** (`(borrower)`, `(ops)`) with two layouts. A shared root layout provides fonts/toaster. Each group's layout does the role gate + redirect (borrower-only vs ops-only) using `getSession()`/`me.role.code`.
- **Login redirect** (`auth-form`): on success, read `me.role.code` → `BORROWER` ⇒ borrower home; ops roles ⇒ operations default section (first permitted). Honors `next` when present (so guarded-apply still works).
- **Sidebar** is a self-contained client component owning collapse state; nav entries are perm-filtered (existing pattern).
- Backend additions are isolated: state-machine + loans/borrower service (cancel), leads service (stage filter), product model/dto/serializer (category). No churn to unrelated modules.

## Error Handling
- Cancel from an illegal state → 409 (state machine). Cancel someone else's loan (borrower path) → 404. Cancel after disbursement → 409. All via existing `AppError` subclasses.

## Testing
- **Backend:** CANCEL transition (allowed APPLIED/SANCTIONED, illegal DISBURSED/CLOSED/REJECTED/CANCELLED), ownership 404, re-apply allowed after cancel, metrics denominator excludes CANCELLED, byStatus includes CANCELLED; leads stage derivation + filter; product `category` round-trip. Full suite stays green.
- **Frontend:** role-based login redirect (borrower vs ops); borrower portal blocks ops users and vice-versa; landing carousel (max 5 + see-more); catalog card → detail; product detail live calculator + guarded apply; my-loans cancel flow (enabled APPLIED/SANCTIONED, disabled DISBURSED); collapsible sidebar (expand/collapse, icons-only); no Welcome page; no "LMS Ops" string; Sales stage filter; audit trail shows CANCEL.
- **Live E2E:** ops login → operations console (collapsible nav, queues, audit trail); borrower login → landing carousel → product detail → guarded apply → track → cancel before disbursement; role cross-access blocked.

## Build Order
1. **Phase 1 — Backend** (cancel + state machine, leads stages/filter, product category, metrics denominator). 
2. **Phase 2 — Borrower portal** (route group, landing carousel, catalog, product detail + live calc, guarded apply, my-loans + cancel, logout).
3. **Phase 3 — Operations portal** (collapsible sidebar, remove welcome/branding, role-scoped default routing, Sales stage filter UI, products category field, audit-trail reachability, CANCELLED rendering).
4. **Live E2E** + report.

Each phase: subagent-driven implement → review → fix → green, then the next.
