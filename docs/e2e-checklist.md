# End-to-End Smoke Verification Checklist

Run this checklist against a fully-started stack (`docker compose up --build`).
Each step must pass before proceeding to the next.

---

## Prerequisites

- Stack is up: `docker compose ps` shows `backend` and `frontend` running, `seed` exited 0.
- Browser pointed at `http://localhost:3000`.

---

## Steps

1. Open `http://localhost:3000` → redirected to `/login`.

2. Sign up a new borrower (e.g. `demo+1@x.com` / `Passw0rd!`) → lands on `/apply`.

3. **Step Details — BRE FAIL case:** DOB `1960-01-01`, salary `10000`, Unemployed → 422; UI lists Age/Salary/Employment failures.

4. **Step Details — BRE PASS case:** name `Rahul`, PAN `ABCDE1234F`, DOB `1995-04-12`, salary `45000`, Salaried → advances.

5. **Step Salary Slip** — upload a small PDF/JPG/PNG (<5 MB) → advances.

6. **Step Loan & Apply** — set amount ₹2,00,000, tenure 60 → live panel shows Total ₹2,03,945 → Apply → `/my-loans` shows `APPLIED` loan `LMS-2026-000001`.

7. Log out. Log in as `sanction@lms.test` / `Sanction@123` → `/dashboard` → Sanction module shows the `APPLIED` loan → Approve → `SANCTIONED`.
   _(Also verify Reject requires a reason on a second test loan.)_

8. Log out. Log in as `disbursement@lms.test` / `Disburse@123` → Disbursement module shows the `SANCTIONED` loan → Disburse → `DISBURSED`.

9. Log out. Log in as `collection@lms.test` / `Collect@123` → Collection module shows the `DISBURSED` loan (outstanding ₹2,03,945).
   - Record a partial payment (`UTR-001`, ₹50,000) → outstanding drops, status stays `DISBURSED`.
   - Try the same UTR again → "Duplicate UTR" error.
   - Try an amount above outstanding → validation error.
   - Record the remaining balance (`UTR-002`) → status auto-`CLOSES`.

10. Log back in as the borrower → `/my-loans` shows the loan `CLOSED`, outstanding ₹0, both payments listed.

11. **RBAC checks:**
    - As the borrower, visit `http://localhost:3000/sanction` → redirected to `/forbidden`.
    - As `sales@lms.test`, the sidebar shows only Sales; hitting `/collection` redirects to `/forbidden`.
    - With no session, hitting `/api/v1/loans` directly returns `401`; as Sales it returns `403`.
    - Log in as `admin@lms.test` / `Admin@123` → all modules visible; `/admin/roles` lists every role's permissions.

---

## Pass criteria

All 11 steps complete without unexpected errors. Any failure is a bug to fix in the relevant sub-repo before submission.
