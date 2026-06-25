# LMS Product v2 — Design Spec

**Date:** 2026-06-25
**Status:** Approved direction (user approved Section 1 + delegated the rest; will review via functionality)
**Builds on:** the completed LMS (lms-backend + lms-frontend, live & verified).

---

## 1. Goal

Turn the LMS from a bare app-behind-login into a conversion-oriented product: a **public marketing landing page** with a smart Apply CTA, a **complete registration** flow (first/last name, IN phone, confirm password, self-hosted captcha), **first-party analytics**, a **one-active-application** rule, and a **visual/UX uplift** (rich palette, lucide icons, responsive navigation).

Both repos change. No breaking change to the loan lifecycle, RBAC, or payments.

### Locked decisions
- **Captcha:** self-hosted SVG captcha (no external keys; works offline).
- **Analytics:** lightweight first-party events (`/track` + `events` collection; anonymous → linked to user via sessionId; funnel + page views + referrer/UTM/UA/session).
- **Re-apply rule:** a new application is allowed only when the borrower has **no active loan** (active = `APPLIED | SANCTIONED | DISBURSED`); i.e. allowed after **REJECTED or CLOSED**.
- **Phone:** IN `+91`, 10-digit `^[6-9]\d{9}$`, stored + **unique** per account, no OTP.
- **Login credential stays email + password.** Registration adds `firstName`, `lastName`, `phone`; `fullName` is derived (`firstName + ' ' + lastName`) and remains the canonical display field for back-compat with seeded staff accounts.

---

## 2. Public Landing & smart Apply CTA

**New frontend route group `(marketing)`** — public, no dashboard/portal chrome; a shared marketing **Navbar** (logo, links, auth-aware CTA) + **Footer**; mobile hamburger nav.

- `/` → **Landing page** (replaces the old "redirect to /login"). Auth-aware: logged-out shows `Log in` + `Apply now`; logged-in shows `My Loans`/`Dashboard` + name.
- Single-scroll sections: **Hero** (headline, `Apply now`, trust badges) → **Loan at a glance** (₹50K–₹5L, **12% p.a.**, 30–365 days, a live estimate widget reusing `calcRepayment`) → **Eligibility** (BRE rules as friendly criteria: age 23–50, income ≥ ₹25,000/mo, Salaried/Self-Employed, valid PAN) → **How it works** (4 steps) → **Why us / features** → **FAQ** → **Footer**.

**Smart Apply CTA routing:**
```
[Apply now]
  └─ logged in?
       ├─ yes & role Borrower → /apply
       ├─ yes & staff/admin   → toast "staff accounts can't apply" (stay/-> /dashboard)
       └─ no → /login?next=/apply   (login page prominently offers "Create an account" → /signup?next=/apply)
```
Reuses the existing `?next=` flow (middleware + AuthForm already honor it). Loan numbers (₹ ranges, 12%, tenure, eligibility) are sourced from a backend **public config** endpoint `GET /public/config` so the landing never hardcodes business numbers that could drift from the BRE/loan-math.

---

## 3. Registration + Captcha

**Signup form fields:** First name, Last name, Email, Phone (`+91` fixed visual prefix; input validates `^[6-9]\d{9}$`), Password (min 8), Confirm password (must equal password), **SVG captcha** (rendered image + refresh button + text input). Lucide icon per field; inline zod validation; sonner errors.

**Captcha flow (self-hosted):**
- `GET /api/v1/auth/captcha` → `{ captchaId, svg }`. Backend uses `svg-captcha` to generate text; stores `{ _id: captchaId, answerHash, expiresAt }` in a `Captcha` collection with a TTL index (auto-expire ~5 min). The client renders the returned SVG string as an **`<img src="data:image/svg+xml;base64,…">`** (no `dangerouslySetInnerHTML`).
- `POST /api/v1/auth/signup` body adds `{ captchaId, captchaText }`. Service verifies the text against `answerHash` and **consumes** (deletes) the captcha (one-time). Mismatch/expired/missing → **422** `CAPTCHA_INVALID` before any user creation. A `refresh` simply requests a new captcha.

**User model additions:** `firstName: string`, `lastName: string`, `phone: string` (unique, sparse index; validated `^[6-9]\d{9}$`), `fullName` kept (set = `firstName + ' ' + lastName` on signup). Duplicate phone → 409 `PHONE_TAKEN`; duplicate email → existing 409. Seeded staff: keep `fullName`, leave `firstName/lastName/phone` optional/absent (sparse unique index tolerates missing phone).

---

## 4. One active application rule

- `POST /api/v1/borrower/loans` (apply) first checks for an existing loan in `APPLIED | SANCTIONED | DISBURSED` for the borrower → if found, **409** `ACTIVE_APPLICATION_EXISTS` with the active `loanRef` in `details`. Allowed when all prior loans are `REJECTED | CLOSED` (or none).
- This check runs inside the existing apply transaction, before creating the loan.
- **Frontend `/apply`:** a server-side pre-check (`GET /borrower/loans`) — if an active loan exists, render a "You already have an application in progress (LMS-…)" card with a CTA to **My Loans**, instead of the wizard. The landing Apply CTA still routes to `/apply`, which then shows this state. My Loans surfaces the rule too (the "Start new application" button is disabled/hidden while active).

---

## 5. First-party analytics

- **`Event` collection:** `{ name, sessionId, userId?, path, referrer?, utm?: {source,medium,campaign}, userAgent?, ip?, ts }`. Indexed on `{ sessionId }` and `{ name, ts }`.
- **`POST /api/v1/track`** — public, rate-limited, accepts a batch `{ events: [{ name, path, referrer?, utm?, ts? }] }`; the server fills `sessionId` (from cookie), `userId` (if authenticated via the optional auth), `userAgent`, `ip`, `ts`. Never blocks UX (fire-and-forget, always 202).
- **Session stitching:** a first-party, non-httpOnly `sid` cookie (uuid) is set on first visit; anonymous events carry it. Events are **immutable** — we do NOT rewrite past rows. Once the user authenticates, subsequent events carry both `sessionId` and `userId`, and any analytics join links the pre-signup anonymous events to the user **by `sessionId`** (no bulk update of historical rows).
- **Client `track()` helper:** fires `landing_view`, `apply_clicked`, `signup_started`, `signup_completed`, `application_submitted`, and SPA `page_view` on navigation. No third-party SDK; respects a simple do-not-track guard.
- **Stretch (low priority, may defer):** admin-only `/dashboard/analytics` with funnel counts (`rbac:read` or a new `analytics:read` perm). Not required for v2 acceptance.

---

## 6. UI/UX system

- **Palette (rich, fintech-trustworthy):** deep **indigo/violet** primary, **emerald** success accent, **amber** pending/warning, on a **slate** neutral base; light + dark via shadcn CSS variables in `globals.css` so existing components inherit. Status badge mapping unchanged (APPLIED→blue, SANCTIONED→amber, DISBURSED→violet, CLOSED→emerald, REJECTED→red).
- **Icons:** `lucide-react` across nav, hero/feature cards, form fields, statuses, dashboard.
- **Navigation:** shared marketing Navbar + Footer (responsive, hamburger on mobile); portal and dashboard shells keep structure but adopt the new palette + icons; the borrower portal/My Loans/dashboard get a light polish pass (spacing, iconography) without restructuring.

---

## 7. Data model & API summary

**Collections:** `User` (+`firstName`,`lastName`,`phone` unique-sparse), **`Captcha`** (`answerHash`, `expiresAt` TTL), **`Event`** (analytics). Loan/Payment/Role/Permission unchanged.

**New/changed endpoints:**
- `GET /public/config` — public loan params (amount range, rate, tenure range, eligibility) for the landing.
- `GET /auth/captcha` — issue captcha; `POST /auth/signup` — now requires `firstName,lastName,phone,confirmPassword(checked client-side),captchaId,captchaText`; verifies captcha + unique phone.
- `POST /track` — analytics ingest (public, optional-auth, rate-limited).
- `POST /borrower/loans` — adds the active-application 409 guard.

**Env additions:** none required (captcha + analytics are self-contained). `CAPTCHA_TTL_SECONDS` optional (default 300).

---

## 8. Testing posture

- Backend: unit/integration for captcha issue+verify+consume (422 on wrong/expired), signup with new fields (phone uniqueness 409, captcha gate), the active-application 409 rule, `/track` ingest + session stitching, `/public/config` shape.
- Frontend: signup form validation (confirm-password mismatch, phone format, captcha required), landing Apply-CTA routing by auth/role, `/apply` blocked-state card, `track()` helper fires expected events. Build + lint green.

---

## 9. Out of scope (YAGNI)
OTP/phone verification, real email/SMS sending, third-party analytics SDKs, a CMS for landing copy (content is coded), and anything beyond a simple optional analytics summary view.
