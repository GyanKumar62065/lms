# LMS v4 — Live Verification Results

**Date:** 2026-06-26
**Stack:** Docker Compose (mongo replica-set, minio, backend :4000, frontend :3100), rebuilt from v4 code + reseeded.
**Backend:** `lms-backend@3c1fcce` — 184 tests / 51 suites green.
**Frontend:** `lms-frontend@8f87e83` — 122 tests / 47 files green, clean build.

Built as **two concurrent tracks** (backend ∥ frontend), 28 tasks, each implement → independent review → fix. Cross-cutting checks done inline (the opus whole-branch reviewers repeatedly tripped an infra 600s watchdog on the large diffs); both repos pass on money-unit consistency, single-source ops routing, RBAC, and the cancel flow.

## What v4 delivered

**Two separated portals (role-routed at login):**
- **Borrower Portal** — public landing with a ≤5 product carousel + "See more"; public catalog → product **detail page** (category, eligibility, tenure, rate, **live calculator**, description) → guarded Apply; My-Loans with **cancel** + a read-only **repayment collections table** (S.No/Date/UTR/Amount/Status/Running-balance) + document preview/download; logout.
- **Operations Portal** — **collapsible icons-only sidebar** (no "LMS Ops"); `/dashboard` redirects to the first permitted section (no Welcome page); every queue row opens a shared **loan-detail workspace** (terms + document preview/download + audit trail + in-context action); Sanction (Approve/Reject), Disbursement (Disburse), Collection (**Record Collection** from row & detail); Sales **stage filter** (surfaces drop-offs); Products gains a category field; Roles.
- **Cross-portal gating:** a borrower hitting an ops URL → `/`; an ops user hitting a borrower URL → their ops home.

**Cancel:** new `CANCELLED` status; borrower cancels APPLIED/SANCTIONED (before disbursement); re-apply allowed after cancel; metrics exclude CANCELLED from approval-rate denominator.

## Live E2E (all green)

| # | Check | Result |
|---|-------|--------|
| 1 | Admin creates product **with category** → public catalog shows it | `category: 'Consumer'` ✓ |
| 2 | Borrower signup → profile → apply PERSONAL | APPLIED ✓ |
| 3 | Borrower **cancels** own APPLIED loan | `CANCELLED`, reason recorded ✓ |
| 4 | **Re-apply** PERSONAL after cancel | 201 (CANCELLED not counted active) ✓ |
| 5 | **Document** presign-GET: borrower own (localhost:9000) + ops 200; borrower→ops route **403** | ✓ |
| 6 | Lifecycle + **borrower repayment view** `{loan,payments}`: disburse → partial → borrower sees entries (**no `recordedBy`**) → full → **CLOSED** | ✓ |
| 7 | Cancel a CLOSED loan | **409** ✓ |
| 8 | Leads **stages + filter** (stage=APPLIED returns only APPLIED) | ✓ |
| 9 | Metrics: byStatus includes **CANCELLED**; approvalRate 100 (decided excludes cancelled, 0–100 scale) | ✓ |
| 10 | **Two-portal gating**: borrower→/sanction `307→/`; ops→/my-loans & /dashboard `307→/admin/overview`; borrower→/my-loans 200; public /products 200; /products/[code] 200; ops /loans/<id> 200 | ✓ |

## Bug caught by live testing (and fixed)

The public **product detail page** (`/products/[code]`) fetched the **authed** `GET /products/:code` (`product:read`), so an anonymous visitor got 401 → `notFound()` → **404**. Unit tests didn't catch it (the endpoint was mocked). **Fix (`8f87e83`):** the public detail page now reads the public (active-only) catalog and matches by code — `/products/PERSONAL` returns 200. This is precisely the class of integration bug only a live run surfaces.

## Notable concurrency lesson
Running two *writers* (an implementer + a fix) in the same repo simultaneously caused one file collision (`isOpsUser` added to a file another task was deleting); the fix agent auto-reconciled it, but the rule going forward: **writers serial per repo; only read-only reviewers overlap.**

## Backlogged minors (non-blocking)
Backend: `getLead` single-detail stale stage; `byProduct.approvalRate` denominator not per-product-cancelled. Frontend: `LoanDocument`/`DocumentRef` duplicate type; native `<select>` in Sales filter (vs base-ui); dead `collection-panel.tsx`; `/admin/loans/[id]` could converge onto the shared `LoanWorkspace`; reject-reason not reset on dialog close.
