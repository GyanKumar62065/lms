# LMS Backend

A Loan Management System (LMS) REST API built with **Express + TypeScript**, compiled with **Bun**, backed by **MongoDB** (replica set for transactions) and **MinIO** for salary-slip object storage.

---

## Architecture

```
┌──────────────┐     HTTP/JSON      ┌────────────────────────────────┐
│  Client/UI   │ ──────────────────▶│  Express app  (port 4000)      │
└──────────────┘                    │  • Helmet / CORS / rate-limit  │
                                    │  • JWT httpOnly cookies         │
                                    │  • RBAC (permissions + roles)  │
                                    │  • Pino structured logging      │
                                    └──────────┬─────────────┬───────┘
                                               │             │
                                    ┌──────────▼──┐  ┌───────▼──────┐
                                    │  MongoDB 7  │  │  MinIO S3    │
                                    │  (rs0 repl) │  │  (port 9000) │
                                    └─────────────┘  └──────────────┘
```

**Key modules:**

| Module | Responsibility |
|---|---|
| `auth` | Signup, login, token refresh, logout, current-user |
| `borrower` | Borrower profile + BRE, salary-slip presign/confirm, loan apply, own-loan list |
| `leads` | Sales funnel view (derived stage), contact log |
| `loans` | Staff loan list/detail, sanction/reject/disburse transitions |
| `payments` | Record repayments (unique UTR, auto-close on payoff) |
| `rbac` | Admin: list roles with permissions |
| `seed` | Idempotent DB seed (permissions → roles → users) |

---

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- (Tests only) **Node 20** (`nvm use 20`) and **Bun** (`/opt/homebrew/bin/bun`)

---

## Quick Start

```bash
# 1. Copy and review environment variables
cp .env.example .env

# 2. Build and launch all services
docker compose up --build
```

This starts:
- `mongo` — MongoDB 7 single-node replica set (rs0)
- `minio` — MinIO object storage + auto-created `salary-slips` bucket
- `backend` — LMS API on http://localhost:4000
- `seed` — one-shot container that seeds users/roles/permissions then exits

### Health checks

```
GET /healthz   → { "status": "ok" }
GET /readyz    → { "status": "ready" } (503 until Mongo connected)
```

---

## Seeded Credentials

After `docker compose up`, the following accounts are ready:

| Role | Email | Password |
|---|---|---|
| Admin | admin@lms.test | Admin@123 |
| Sales | sales@lms.test | Sales@123 |
| Sanction | sanction@lms.test | Sanction@123 |
| Disbursement | disbursement@lms.test | Disburse@123 |
| Collection | collection@lms.test | Collect@123 |
| Borrower | borrower@lms.test | Borrow@123 |

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `4000` | HTTP listen port |
| `MONGO_URI` | `mongodb://mongo:27017/lms` | MongoDB connection string (compose overrides to include `?replicaSet=rs0`) |
| `MONGO_POOL_MIN` | `2` | Mongoose min pool size |
| `MONGO_POOL_MAX` | `20` | Mongoose max pool size |
| `JWT_ACCESS_SECRET` | _(required)_ | HS256 secret for access tokens |
| `JWT_REFRESH_SECRET` | _(required)_ | HS256 secret for refresh tokens |
| `JWT_ACCESS_TTL` | `15m` | Access token lifetime |
| `JWT_REFRESH_TTL` | `7d` | Refresh token lifetime |
| `PASSWORD_PEPPER` | _(required)_ | Server-side pepper mixed into bcrypt hash |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `MINIO_ENDPOINT` | `http://minio:9000` | MinIO (or S3-compatible) endpoint |
| `MINIO_REGION` | `us-east-1` | S3 region |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `salary-slips` | Bucket for salary slip uploads |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `COOKIE_SECURE` | `false` | Set `true` in production (HTTPS) |
| `CAPTCHA_TTL_SECONDS` | `300` | (Optional) Captcha expiry in seconds |

---

## API Endpoint Summary

All API routes are prefixed with `/api/v1`.

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/captcha` | — | Get a new SVG captcha (returns `captchaId` + SVG data) |
| POST | `/signup` | — | Register a new user — body: `email`, `password`, `firstName`, `lastName`, `phone` (+91 mobile), `captchaId`, `captchaText` |
| POST | `/login` | — | Login; sets `accessToken` + `refreshToken` cookies |
| POST | `/refresh` | cookie | Rotate access token |
| POST | `/logout` | cookie | Clear auth cookies |
| GET | `/me` | required | Current user info |

### Borrower — `/api/v1/borrower`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/profile` | `loan:apply` | Get borrower profile |
| PUT | `/profile` | `loan:apply` | Create/update borrower profile |
| POST | `/salary-slip/presign` | `loan:apply` | Get a presigned MinIO upload URL |
| PUT | `/salary-slip` | `loan:apply` | Confirm slip upload (stage for BRE) |
| POST | `/loans` | `loan:apply` | Apply for a loan (runs BRE); 409 if an active application already exists |
| GET | `/loans` | `loan:read:own` | List own loans |
| GET | `/loans/:id` | `loan:read:own` | Get own loan detail |

### Leads — `/api/v1/leads`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `lead:read` | List leads with derived funnel stage |
| GET | `/:userId` | `lead:read` | Lead detail |
| PATCH | `/:userId/contacted` | `lead:read` | Log sales contact |

### Loans — `/api/v1/loans`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `loan:read:all` | List all loans (filterable) |
| GET | `/:id` | `loan:read:all` | Loan detail |
| POST | `/:id/sanction` | `loan:sanction` | Approve loan |
| POST | `/:id/reject` | `loan:sanction` | Reject loan with reason |
| POST | `/:id/disburse` | `loan:disburse` | Disburse loan |

### Payments — `/api/v1/loans/:id/payments`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/` | `payment:read` | List payments for a loan |
| POST | `/` | `payment:create` | Record a repayment (unique UTR) |

### Public — `/api/v1/public`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/config` | — | Public config (e.g. interest rate, max loan amount) |

### Analytics — `/api/v1`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/track` | optional | Record a client-side analytics event |

### Admin — `/api/v1/admin`

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/roles` | `rbac:read` | List all roles with permissions |

---

## Running Tests Locally

Tests require Node 20 (the default system Node may be older). Ensure Node 20 is active:

```bash
# with nvm
nvm use 20

# run the full test suite (uses in-memory MongoDB)
bun run test
# or: ./node_modules/.bin/jest --runInBand
```

> Note: Payment tests use `MongoMemoryReplSet` (replica set required for transactions). All other tests use the simpler `MongoMemoryServer`.

---

## MinIO Console

The MinIO web console is available at http://localhost:9001 (credentials: `minioadmin` / `minioadmin`).
