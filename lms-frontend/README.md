# LMS Frontend

Next.js 16 frontend for the Loan Management System. Provides a borrower self-service portal and a staff operations dashboard, backed by the LMS REST API.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20.x |
| Bun | 1.x |
| Docker + Compose | (for container mode) |

## Quick start — local dev

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Install dependencies (uses Bun)
bun install

# 3. Start the dev server (hot-reload on http://localhost:3000)
bun run dev
```

The backend API must be running before the frontend can authenticate or serve data.
See the backend README or the root orchestration compose for instructions.

## Quick start — Docker container

```bash
# Build and run (production standalone image)
docker compose up --build
```

The frontend is available at http://localhost:3000.

`NEXT_PUBLIC_API_URL` is baked into the image at build time (required by Next.js for client-side usage). `API_URL_INTERNAL` is used by Server Components when calling the backend from inside the container network.

To override the API URL at build time:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 \
  -t lms-frontend .
```

## Route map

### Borrower portal (`/(portal)`)

| Route | Description | Access |
|-------|-------------|--------|
| `/apply` | 4-step loan application wizard (auth → details + BRE → salary slip upload → repayment config + submit) | `borrower` role |
| `/my-loans` | Loan status view with timeline, repayment schedule, and outstanding balance | `borrower` role |

### Staff dashboard (`/(dashboard)`)

| Route | Module | Required permission |
|-------|--------|---------------------|
| `/sales` | New-loan intake, lead management | `loans:create` |
| `/sanction` | Approve or reject pending loans | `loans:sanction` |
| `/disbursement` | Disburse sanctioned loans | `loans:disburse` |
| `/collection` | Record repayments, view overdue loans | `loans:collect` |
| `/admin/roles` | Manage roles and permission assignments | `roles:manage` |

### Auth (`/(auth)`)

| Route | Description |
|-------|-------------|
| `/login` | Email + password login (sets httpOnly session cookie) |
| `/signup` | Borrower self-registration |

### Role-based landing

- **borrower** — redirected to `/apply` after login
- **staff / admin** — redirected to `/dashboard` after login; sidebar shows only modules the user has permission for

## Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Client + Server Components | Browser-facing API base URL |
| `API_URL_INTERNAL` | Server Components (container only) | Internal Docker network URL for server-to-backend calls |

Copy `.env.example` to `.env` and adjust as needed for local development.

## Backend dependency

The frontend requires the LMS backend API to be running. Refer to:

- **Backend README** — `../lms-backend/README.md`
- **Root orchestration compose** — `../docker-compose.yml` (starts both services together)

## Tech stack

- Next.js 16 (App Router, standalone output)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- Bun (package manager + build runner)
- Vitest + Testing Library (unit tests)
