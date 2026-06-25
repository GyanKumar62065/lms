# Product v3 — Live Verification Results

**Date:** 2026-06-25
**Stack:** Docker Compose (mongo replica-set, minio, backend :4000, frontend :3100), rebuilt from v3 code.
**Backend:** `lms-backend@9e27c1c` — 155 tests / 44 suites green.
**Frontend:** `lms-frontend@51c1425` — 71 tests / 30 files green, clean production build (19 routes).

Both repos passed an opus whole-branch final review (ship-grade; money-unit consistency clean across all render sites).

## What v3 added

**Part A — Loan Products (admin-posted catalog):** `LoanProduct` entity (per-product rate, principal/tenure bounds, eligibility); admin CRUD (`product:manage`) + read (`product:read`); borrower catalog → product-scoped apply with bounds/eligibility validated against the chosen product; **one active application per product**; **term snapshot** (rate/code/name frozen onto the loan at apply). Seeded catalog: PERSONAL (12%), SALARY_ADVANCE (18%).

**Part B — Admin dashboard:** `GET /admin/metrics` (KPIs, funnel, by-status, by-product, 12-month time series); filterable/sortable/paginated loans list; loan detail with an assembled audit timeline (actor + timestamp per event). Frontend overview page (KPI cards + Recharts charts + per-product table), loans list with filter bar, loan detail with timeline.

## Live E2E (all green)

| # | Check | Result |
|---|-------|--------|
| 1 | Public product catalog | PERSONAL 12% / SALARY_ADVANCE 18%, correct bounds |
| 2 | Admin creates product | 201 |
| 3 | RBAC: sales reads products 200 / cannot manage 403 | ✓ |
| 4 | Borrower signup (captcha) + profile | 201 / 200 |
| 5 | Apply vs PERSONAL — snapshot rate/code/name | APPLIED, rate 12, total ₹2,03,945.21 |
| 6 | Principal above product max → 422 PRODUCT_BOUNDS (range in details) | ✓ |
| 7 | Per-product one-active: re-apply PERSONAL 409 / SALARY_ADVANCE 201 | ✓ |
| 8 | Sanction → disburse → pay full → CLOSED (auto-close) | ✓ |
| 8b | Back-dated payment (paidAt < disbursement) → 422 | ✓ (final-review guard) |
| 9 | Re-apply PERSONAL after CLOSED → 201 | ✓ |
| 10 | Metrics KPIs/byStatus/byProduct/timeSeries; approvalRate 0–100; borrower 403 | ✓ |
| 11 | Loans list pagination + productCode/status filters | ✓ |
| 12 | Loan detail audit timeline (actor names + ₹ payment) | ✓ ordered, correct rupees |
| 13 | Frontend pages (/ , /products, /signup, /login, /admin/*) | ✓ |

Server-side render verified under admin auth: `/admin/overview` (200) renders KPI cards + all four chart components + per-product data; `/admin/loans` (200) renders the table + filter bar; `/admin/products` (200). Landing page server-renders the product-aware estimate widget.

## Notable bugs caught by the review loop (fixed before live)

- `GET /loans/:id` shape change (`{loan,payments,timeline}`) reconciled; dead mistyped `endpoints.loan(id)` removed.
- `approvalRate`/`rejectionRate` ×100 double-scale (would show "7500%") fixed across KPI cards + per-product table.
- Loan-detail payment amount formatter (rupees vs paise) — fixed 100×-too-small display.
- Final review: `paidAt >= disbursement.at` guard; `to` date filter made end-of-day inclusive; compound index `{borrower,product,status}` for the per-product guard.

## Backlogged minors (non-blocking)
Dead `DISBURSEMENT` timeline type; `totalRecovered` vs `timeSeries.recovered` source seam; chart Y-axis tick formatting; `key={i}` on timeline entries; silent catch on product fetch (graceful empty-state); icon a11y labels.
