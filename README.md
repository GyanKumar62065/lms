# LMS — Loan Management System

A full-stack Loan Management System comprising a borrower self-service portal and a role-guarded operations dashboard for Sales, Sanction, Disbursement, Collection, and Admin staff. Borrowers apply online, upload salary slips (stored in MinIO), and track their loan lifecycle in real time. Back-office roles see only the modules their RBAC permissions allow, with enforcement on both the frontend (route guards) and the API (401/403).

---

## Architecture

```
Browser
  │
  ▼
┌─────────────────┐        ┌─────────────────────┐
│  Frontend        │        │  Backend (Express)   │
│  Next.js 14      │◄──────►│  TypeScript/Mongoose │
│  Port 3000       │  REST  │  Port 4000           │
│  (lms-frontend)  │  +JWT  │  (lms-backend)       │
└─────────────────┘        └──────┬──────────┬────┘
                                  │          │
                         ┌────────▼──┐  ┌────▼──────┐
                         │  MongoDB   │  │   MinIO   │
                         │  (rs0)     │  │  Port 9000│
                         │  Port 27017│  │  (files)  │
                         └────────────┘  └───────────┘

All services share one Docker Compose network: lms
Sub-repos (lms-backend, lms-frontend) are independent git repositories.
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui |
| Backend | Express · TypeScript · Mongoose |
| Database | MongoDB 7 (replica set rs0 — required for transactions) |
| File storage | MinIO (S3-compatible) |
| Auth | JWT access + refresh tokens in HTTP-only cookies |
| Runtime | Bun (backend) |
| Infra | Docker Compose |

---

## Quick Start

```bash
git clone <backend-repo-url> lms-backend
git clone <frontend-repo-url> lms-frontend
cp .env.example .env        # edit secrets if desired
docker compose up --build

# Frontend:      http://localhost:3100
# API:           http://localhost:4000/api/v1
# MinIO console: http://localhost:9001  (minioadmin / minioadmin)
```

The `seed` service runs automatically and populates roles, permissions, and the six staff accounts below. It is idempotent — re-running the stack will not duplicate data.

---

## Seeded Login Credentials

| Role | Email | Password | Can access |
|------|-------|----------|------------|
| Admin | admin@lms.test | Admin@123 | All modules |
| Sales | sales@lms.test | Sales@123 | Sales (leads) |
| Sanction | sanction@lms.test | Sanction@123 | Sanction |
| Disbursement | disbursement@lms.test | Disburse@123 | Disbursement |
| Collection | collection@lms.test | Collect@123 | Collection |
| Borrower | borrower@lms.test | Borrow@123 | Borrower portal only |

---

## Demo Flow

See [`docs/e2e-checklist.md`](docs/e2e-checklist.md) for the full click-path.

**Summary of the happy path (required for demo video):**

1. **BRE fail:** Borrower submits invalid details (age/salary/employment) → API returns 422 with per-field failure reasons displayed in the UI.
2. **BRE pass:** Valid details → uploads salary slip to MinIO → sets loan amount (₹2,00,000 / 60 months) → applies.
3. **Sanction:** Sanction exec approves the APPLIED loan → status becomes SANCTIONED.
4. **Disburse:** Disbursement exec disburses → DISBURSED.
5. **Payments:** Collection exec records a partial payment (UTR-001) — balance drops; records final payment (UTR-002) — loan **auto-closes** via a MongoDB transaction.
6. **Borrower view:** Borrower sees CLOSED loan, ₹0 outstanding, full payment history.
7. **RBAC:** Accessing a forbidden module redirects to `/forbidden`; the API returns 401 (unauthenticated) or 403 (wrong role).

---

## RBAC Summary

Permissions are seeded statically. Each role carries an explicit allowlist.

| Permission | Admin | Sales | Sanction | Disbursement | Collection | Borrower |
|-----------|:-----:|:-----:|:--------:|:------------:|:----------:|:-------:|
| loans:apply | ✓ | | | | | ✓ |
| loans:read:own | ✓ | | | | | ✓ |
| loans:read:all | ✓ | ✓ | ✓ | ✓ | ✓ | |
| loans:sanction | ✓ | | ✓ | | | |
| loans:disburse | ✓ | | | ✓ | | |
| loans:collect | ✓ | | | | ✓ | |
| users:manage | ✓ | | | | | |
| roles:manage | ✓ | | | | | |

Enforcement is **dual**: the frontend hides routes and the backend validates the JWT role on every protected endpoint (returns 401 for missing session, 403 for insufficient role).

---

## Design Decisions

See [`docs/superpowers/specs/2026-06-25-lms-design.md`](docs/superpowers/specs/2026-06-25-lms-design.md) for the full design document.

Key choices:

- **MongoDB replica set (rs0):** Required for multi-document transactions used in payment recording and loan auto-close.
- **Money stored as paise (integer):** Avoids floating-point rounding errors; all amounts are multiplied by 100 at the API boundary and divided for display only.
- **Server-authoritative BRE:** The Business Rule Engine runs entirely on the backend — the frontend only renders the result. This prevents rule-bypass via API calls.
- **Transactional payments + auto-close:** A payment and the resulting balance update (and optional status transition to CLOSED) happen in a single MongoDB transaction, so partial failures leave no inconsistent state.
- **Static-seed RBAC replication:** Roles and permissions are defined in TypeScript seed files committed to the backend repo. This makes the permission model auditable in version control without a runtime admin UI dependency.

---

## Running Tests

```bash
# Backend — unit + integration (uses in-memory MongoDB)
cd lms-backend && bun run test

# Frontend — component + unit tests (Vitest)
cd lms-frontend && bun run test
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Backend exits on startup with "not primary" | MongoDB replica set hasn't elected a primary yet | Wait ~15 s; the healthcheck retries up to 15 times. |
| `seed` exits non-zero on second run | Seed is idempotent but logs warnings for duplicates | Safe to ignore; use `docker compose logs seed` to inspect. |
| Frontend shows "Failed to fetch" | `NEXT_PUBLIC_API_URL` is baked in at build time | Rebuild the frontend image after changing the variable. |
| Stale data / want a clean slate | Volumes persist between restarts | Run `docker compose down -v` to destroy volumes, then `docker compose up --build`. |
| MinIO upload fails | Bucket not created | Ensure `createbucket` service exited 0: `docker compose logs createbucket`. |
