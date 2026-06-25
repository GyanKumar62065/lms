# Product v2 — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Product v2 frontend — a public marketing landing page with a smart Apply CTA, an upgraded registration (first/last name, IN phone, confirm password, SVG captcha), a first-party analytics client, the "one active application" blocked-state, and a rich design-system uplift (palette + lucide icons + responsive nav).

**Architecture:** Additive to the existing Next.js 16 (App Router) + shadcn(@base-ui) frontend. New public route group `(marketing)` with its own Navbar/Footer; the landing pulls business numbers from `GET /public/config`; signup gains captcha + fields; a tiny analytics client fires funnel + page_view events to `/track`. Existing portal/dashboard keep their shells but adopt the new palette/icons.

**Tech Stack:** existing (Next.js 16, TS strict, Tailwind, shadcn, react-hook-form+zod, lucide-react, sonner, Vitest+RTL).

## Global Constraints

- Package manager/runner: **Bun**; tests via **`bun run test`** (Vitest) — never `bun test`. Prepend Node 20: `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"` (default node v14). Bun at `/opt/homebrew/bin/bun`.
- TypeScript `strict: true`. Next 16: `cookies()`/`headers()` are **async** (await them). shadcn is **@base-ui** (no `asChild`/Slot → use `<Link className={buttonVariants()}>`; Slider takes array value; Dialog uses `render` prop).
- Money shown via `formatRupees` (paise→₹). Backend money fields are paise; the apply/profile/payment APIs accept **rupees**.
- Phone: `+91` fixed visual prefix; input validates `^[6-9]\d{9}$`. Confirm-password must equal password (client-side). Captcha is required.
- Icons: `lucide-react` throughout. Palette: indigo/violet primary, emerald success, amber warning, slate neutral (light+dark) via shadcn CSS variables.
- Every change ends with a conventional commit + `bun run build` green. Work in `/Users/gyankumar/Personal/LMS/lms-frontend`.

---

## File Structure

```
src/
├── app/globals.css                       MODIFY: new palette CSS variables
├── lib/api/endpoints.ts                  MODIFY: +getCaptcha,+publicConfig,+track (signup body changes)
├── types/api.ts                          MODIFY: +PublicConfig, +Captcha types; Me/User no change needed
├── lib/analytics.ts                      NEW: track() client + funnel helpers
├── components/analytics/page-tracker.tsx NEW: client component firing page_view on route change
├── components/marketing/navbar.tsx       NEW: auth-aware marketing navbar (responsive)
├── components/marketing/footer.tsx       NEW
├── components/marketing/apply-cta.tsx    NEW: smart Apply button (auth/role-aware routing)
├── components/marketing/estimate-widget.tsx NEW: live repayment estimate (reuses calcRepayment)
├── app/(marketing)/layout.tsx            NEW: navbar + footer + page tracker
├── app/(marketing)/page.tsx              NEW: landing (replaces old root redirect page)
├── app/page.tsx                          DELETE/REPLACE: root now served by (marketing)/page.tsx
├── components/auth/signup-form.tsx       NEW: dedicated signup form (names/phone/confirm/captcha)
├── app/(auth)/signup/page.tsx            MODIFY: render SignupForm
├── app/(auth)/login/page.tsx             MODIFY: prominent "Create an account" CTA
└── app/(portal)/apply/page.tsx           MODIFY: active-application blocked-state card
```

---

## Task 1: Design system — palette + tokens

**Files:**
- Modify: `src/app/globals.css`
- Test: (visual/build only)

**Interfaces:**
- Produces: updated shadcn CSS variables (`--primary` indigo/violet, `--accent`/success emerald, warning amber, slate neutrals) for light + dark.

- [ ] **Step 1: Update the CSS variables**

In `src/app/globals.css`, replace the `:root` and `.dark` color tokens with a rich palette. Set (HSL or oklch per the existing file's format) `--primary` to a deep indigo/violet (e.g. `#6366F1`-ish), `--primary-foreground` near-white; keep `--background`/`--foreground` slate-neutral; ensure `--ring` matches primary. Keep all variable NAMES identical (only values change) so every shadcn component inherits.

- [ ] **Step 2: Build to verify it compiles + renders**

Run: `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"; bun run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: rich indigo/emerald/amber palette via shadcn tokens"
```

---

## Task 2: API client + types — captcha, public config, track, signup body

**Files:**
- Modify: `src/lib/api/endpoints.ts`, `src/types/api.ts`
- Test: `src/lib/api/__tests__/endpoints-v2.test.ts`

**Interfaces:**
- Produces: `endpoints.getCaptcha(): Promise<{captchaId,svg}>`, `endpoints.publicConfig(opts?): Promise<PublicConfig>`, `endpoints.track(events): Promise<void>`; `endpoints.signup` body now `{firstName,lastName,email,phone,password,captchaId,captchaText}`. `PublicConfig` type.

- [ ] **Step 1: Write the failing test**

`src/lib/api/__tests__/endpoints-v2.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endpoints } from '../endpoints';

beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api/api/v1'); });

describe('v2 endpoints', () => {
  it('getCaptcha hits /auth/captcha', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ captchaId: 'x', svg: '<svg/>' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await endpoints.getCaptcha();
    expect(r.captchaId).toBe('x');
    expect(f.mock.calls[0][0]).toContain('/auth/captcha');
  });
  it('publicConfig hits /public/config', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ loan: { interestRate: 12 } }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await endpoints.publicConfig();
    expect((r as any).loan.interestRate).toBe(12);
    expect(f.mock.calls[0][0]).toContain('/public/config');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- endpoints-v2`
Expected: FAIL.

- [ ] **Step 3: Add the types + endpoints**

In `src/types/api.ts` add:
```ts
export type PublicConfig = {
  loan: { minPrincipal: number; maxPrincipal: number; interestRate: number; minTenureDays: number; maxTenureDays: number };
  eligibility: { minAge: number; maxAge: number; minMonthlySalary: number; employmentModes: string[] };
};
```

In `src/lib/api/endpoints.ts` (extend the `endpoints` object):
```ts
  getCaptcha: (o?: Opts) => get<{ captchaId: string; svg: string }>('/auth/captcha', o),
  publicConfig: (o?: Opts) => get<PublicConfig>('/public/config', o),
  track: (events: { name: string; path?: string; referrer?: string; utm?: any; ts?: string }[]) =>
    apiFetch('/track', { method: 'POST', body: JSON.stringify({ events }) }).catch(() => undefined),
```
Update the `signup` fn signature/body to:
```ts
  signup: (b: { firstName: string; lastName: string; email: string; phone: string; password: string; captchaId: string; captchaText: string }) => post('/auth/signup', b),
```
(Import `PublicConfig` into endpoints.ts.)

- [ ] **Step 4: Run + commit**

Run: `bun run test -- endpoints-v2` then `bun run test`
Expected: PASS.
```bash
git add -A && git commit -m "feat: add captcha/publicConfig/track endpoints + v2 signup body"
```

---

## Task 3: Analytics client — track() + page tracker

**Files:**
- Create: `src/lib/analytics.ts`, `src/components/analytics/page-tracker.tsx`
- Test: `src/lib/__tests__/analytics.test.ts`

**Interfaces:**
- Produces: `track(name, props?)` (queues + sends via `endpoints.track`), named helpers `trackLandingView/trackApplyClicked/trackSignupStarted/trackSignupCompleted/trackApplicationSubmitted`, and `<PageTracker />` (fires `page_view` on pathname change). Respects `navigator.doNotTrack === '1'`.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/analytics.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/endpoints', () => ({ endpoints: { track: vi.fn().mockResolvedValue(undefined) } }));
import { track } from '../analytics';
import { endpoints } from '@/lib/api/endpoints';

beforeEach(() => vi.clearAllMocks());

describe('analytics track', () => {
  it('sends an event with name + path', async () => {
    await track('apply_clicked', { path: '/' });
    expect(endpoints.track).toHaveBeenCalledTimes(1);
    const arg = (endpoints.track as any).mock.calls[0][0];
    expect(arg[0].name).toBe('apply_clicked');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- analytics`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/analytics.ts`:
```ts
import { endpoints } from '@/lib/api/endpoints';

function dnt(): boolean {
  return typeof navigator !== 'undefined' && (navigator as any).doNotTrack === '1';
}

export async function track(name: string, props: { path?: string; referrer?: string; utm?: any } = {}) {
  if (dnt()) return;
  const path = props.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  const referrer = props.referrer ?? (typeof document !== 'undefined' ? document.referrer || undefined : undefined);
  await endpoints.track([{ name, path, referrer, utm: props.utm, ts: new Date().toISOString() }]);
}

export const trackLandingView = () => track('landing_view');
export const trackApplyClicked = () => track('apply_clicked');
export const trackSignupStarted = () => track('signup_started');
export const trackSignupCompleted = () => track('signup_completed');
export const trackApplicationSubmitted = () => track('application_submitted');
```

`src/components/analytics/page-tracker.tsx`:
```tsx
'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export function PageTracker() {
  const pathname = usePathname();
  useEffect(() => { track('page_view', { path: pathname }); }, [pathname]);
  return null;
}
```

- [ ] **Step 4: Run + commit**

Run: `bun run test -- analytics` then `bun run test`
Expected: PASS.
```bash
git add -A && git commit -m "feat: first-party analytics client (track + page tracker)"
```

---

## Task 4: Marketing shell — navbar, footer, layout, estimate widget

**Files:**
- Create: `src/components/marketing/navbar.tsx`, `footer.tsx`, `estimate-widget.tsx`, `src/app/(marketing)/layout.tsx`
- Test: `src/components/marketing/__tests__/estimate-widget.test.tsx`

**Interfaces:**
- Consumes: `getSession` (server), `buttonVariants`, `Link`, lucide icons, `calcRepayment`, `formatRupees`.
- Produces: `Navbar({ me })` (auth-aware: logged-out → Log in + Apply; logged-in → name + My Loans/Dashboard; mobile hamburger). `Footer`. `(marketing)/layout.tsx` = async server component rendering Navbar(me) + children + Footer + `<PageTracker/>`. `EstimateWidget({ config })` — two sliders (array value) + live repayment via `calcRepayment`, testid `estimate-total`.

- [ ] **Step 1: Write the failing test**

`src/components/marketing/__tests__/estimate-widget.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimateWidget } from '../estimate-widget';

const cfg = { loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: 12, minTenureDays: 30, maxTenureDays: 365 }, eligibility: {} as any };
describe('EstimateWidget', () => {
  it('renders a live total for defaults (200000/60 → ₹2,03,945)', () => {
    render(<EstimateWidget config={cfg as any} />);
    expect(screen.getByTestId('estimate-total')).toHaveTextContent('₹2,03,945');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- estimate-widget`
Expected: FAIL.

- [ ] **Step 3: Implement the widget**

`src/components/marketing/estimate-widget.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import type { PublicConfig } from '@/types/api';

export function EstimateWidget({ config }: { config: PublicConfig }) {
  const [amt, setAmt] = useState(200000);
  const [ten, setTen] = useState(60);
  const c = calcRepayment(amt, ten);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Amount</span><span>{formatRupees(amt * 100)}</span></div>
          <Slider min={config.loan.minPrincipal} max={config.loan.maxPrincipal} step={5000} value={[amt]} onValueChange={(v) => setAmt(num(v))} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Tenure</span><span>{ten} days</span></div>
          <Slider min={config.loan.minTenureDays} max={config.loan.maxTenureDays} step={1} value={[ten]} onValueChange={(v) => setTen(num(v))} />
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm">Total repayment ({config.loan.interestRate}% p.a.)</span>
          <span data-testid="estimate-total" className="text-xl font-semibold">{formatRupees(c.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Implement navbar, footer, layout**

`src/components/marketing/navbar.tsx` — client component taking `me: Me | null`; left: logo (lucide `Landmark` + "LendFlow"); center links (`Loans`, `How it works`, `FAQ` as anchor links to landing sections); right: if `me` → name + `<Link href={me.role.code==='BORROWER'?'/my-loans':'/dashboard'} className={buttonVariants()}>` ; else → `<Link href="/login" className={buttonVariants({variant:'ghost'})}>Log in</Link>` + an `<ApplyCTA me={null}/>`. Mobile: a `Menu` icon toggling a panel. (Use `buttonVariants`, not `<Button asChild>`.)

`src/components/marketing/footer.tsx` — simple footer with product links + a line "Demo project · seeded logins in README".

`src/app/(marketing)/layout.tsx`:
```tsx
import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/marketing/navbar';
import { Footer } from '@/components/marketing/footer';
import { PageTracker } from '@/components/analytics/page-tracker';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar me={me} />
      <main className="flex-1">{children}</main>
      <Footer />
      <PageTracker />
    </div>
  );
}
```

- [ ] **Step 5: Run + commit**

Run: `bun run test -- estimate-widget` then `bun run test` and `bun run build`
Expected: PASS; build OK.
```bash
git add -A && git commit -m "feat: marketing shell (navbar, footer, layout) + estimate widget"
```

---

## Task 5: Smart Apply CTA

**Files:**
- Create: `src/components/marketing/apply-cta.tsx`
- Test: `src/components/marketing/__tests__/apply-cta.test.tsx`

**Interfaces:**
- Consumes: `useRouter`, `trackApplyClicked`, `toast`.
- Produces: `ApplyCTA({ me, label?, variant? })` — on click: `track apply_clicked`; if no `me` → `router.push('/login?next=/apply')`; if `me.role.code==='BORROWER'` → `/apply`; else → `toast` "staff accounts can't apply" + `/dashboard`.

- [ ] **Step 1: Write the failing test**

`src/components/marketing/__tests__/apply-cta.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/analytics', () => ({ trackApplyClicked: vi.fn() }));
import { ApplyCTA } from '../apply-cta';

beforeEach(() => push.mockClear());
describe('ApplyCTA', () => {
  it('routes anonymous users to /login?next=/apply', async () => {
    render(<ApplyCTA me={null} />);
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith('/login?next=/apply');
  });
  it('routes a borrower to /apply', async () => {
    render(<ApplyCTA me={{ role: { code: 'BORROWER' } } as any} />);
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith('/apply');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- apply-cta`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/marketing/apply-cta.tsx`:
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackApplyClicked } from '@/lib/analytics';
import type { Me } from '@/types/api';

export function ApplyCTA({ me, label = 'Apply now', variant }: { me: Me | null; label?: string; variant?: 'default' | 'secondary' | 'outline' }) {
  const router = useRouter();
  const onClick = () => {
    trackApplyClicked();
    if (!me) return router.push('/login?next=/apply');
    if (me.role.code === 'BORROWER') return router.push('/apply');
    toast.message("Staff accounts can't apply for loans");
    router.push('/dashboard');
  };
  return (
    <Button variant={variant} onClick={onClick}>
      {label} <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `bun run test -- apply-cta` then `bun run test`
Expected: PASS.
```bash
git add -A && git commit -m "feat: smart auth/role-aware Apply CTA"
```

---

## Task 6: Landing page

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Delete: `src/app/page.tsx` (old root redirect — the marketing group now owns `/`)
- Test: (build + the widget/CTA tests cover the interactive parts)

**Interfaces:**
- Consumes: `getSession`, `endpoints.publicConfig` (server fetch, `serverBase: API_URL_INTERNAL`), `EstimateWidget`, `ApplyCTA`, lucide icons.
- Produces: `/` landing — hero (headline + `ApplyCTA` + trust row), "Loan at a glance" with `EstimateWidget`, Eligibility (from config.eligibility), How it works (4 steps), Features, FAQ. Sections have `id`s (`#loans`, `#how`, `#faq`) for navbar anchors.

- [ ] **Step 1: Delete the old root page**

```bash
git rm src/app/page.tsx
```
(The role-based redirect it did is no longer the root behavior — logged-in users see the landing; the Apply/My Loans CTAs route them onward.)

- [ ] **Step 2: Implement the landing page**

`src/app/(marketing)/page.tsx` (async server component): fetch `me = await getSession()` and `config = await endpoints.publicConfig({ serverBase: process.env.API_URL_INTERNAL })`. Render the sections described in Interfaces using shadcn `Card`, lucide icons (`ShieldCheck`, `Zap`, `BadgeIndianRupee`, `Clock`, `FileCheck`, `CheckCircle2`), `EstimateWidget config={config}`, and `ApplyCTA me={me}`. Eligibility list built from `config.eligibility` (age range, `minMonthlySalary` via formatRupees of *100, employment modes, "Valid PAN"). Keep copy concise and benefit-led. The hero also fires `landing_view` — render a small client `<LandingView/>` effect or call it inside `EstimateWidget`'s parent client island; simplest: add a one-line client component `components/analytics/landing-view.tsx` that calls `trackLandingView()` in `useEffect` and include it on the page.

`src/components/analytics/landing-view.tsx`:
```tsx
'use client';
import { useEffect } from 'react';
import { trackLandingView } from '@/lib/analytics';
export function LandingView() { useEffect(() => { trackLandingView(); }, []); return null; }
```

- [ ] **Step 3: Build to verify**

Run: `bun run build`
Expected: succeeds; `/` is the landing (dynamic, fetches config + session).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: public marketing landing page with estimate + eligibility + apply CTA"
```

---

## Task 7: Signup form uplift (names, phone, confirm, captcha)

**Files:**
- Create: `src/components/auth/signup-form.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Test: `src/components/auth/__tests__/signup-form.test.tsx`

**Interfaces:**
- Consumes: `endpoints.signup/getCaptcha`, `trackSignupStarted/Completed`, react-hook-form+zod, lucide icons.
- Produces: `SignupForm` — fields firstName, lastName, email, phone (`+91` adornment), password, confirmPassword (zod `.refine` equality), captcha (image from `getCaptcha`, refresh button, text input). On submit: `endpoints.signup({...,captchaId,captchaText})`; success → `trackSignupCompleted` + `router.push(next ?? '/')` + refresh; 422 CAPTCHA_INVALID → toast + auto-refresh captcha; 409 → toast "email or phone already registered".

- [ ] **Step 1: Write the failing test**

`src/components/auth/__tests__/signup-form.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { getCaptcha: vi.fn().mockResolvedValue({ captchaId: 'c', svg: '<svg/>' }), signup: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ trackSignupStarted: vi.fn(), trackSignupCompleted: vi.fn() }));
import { SignupForm } from '../signup-form';

describe('SignupForm', () => {
  it('shows a confirm-password mismatch error', async () => {
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText(/first name/i), 'A');
    await userEvent.type(screen.getByLabelText(/last name/i), 'B');
    await userEvent.type(screen.getByLabelText(/email/i), 'a@x.com');
    await userEvent.type(screen.getByLabelText(/phone/i), '9876543210');
    await userEvent.type(screen.getByLabelText(/^password/i), 'Passw0rd!');
    await userEvent.type(screen.getByLabelText(/confirm/i), 'different');
    await userEvent.type(screen.getByLabelText(/captcha/i), 'abcde');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- signup-form`
Expected: FAIL.

- [ ] **Step 3: Implement `SignupForm`**

`src/components/auth/signup-form.tsx` — `'use client'`; zod schema:
```ts
const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile'),
  password: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
  captchaText: z.string().min(1, 'Enter the captcha'),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
```
Load a captcha in `useEffect` (`getCaptcha` → store `{captchaId,svg}` in state); render the svg as `<img alt="captcha" src={`data:image/svg+xml;base64,${btoa(svg)}`} />` with a `RefreshCw` refresh button that reloads it. Phone input has a `+91` left adornment. On submit, call `endpoints.signup({ firstName,lastName,email,phone,password, captchaId, captchaText })`. Handle 422 (`e.details`? code CAPTCHA_INVALID → toast + refresh captcha), 409 (toast). Fire `trackSignupStarted` on mount and `trackSignupCompleted` on success. Use lucide icons (`User`, `Mail`, `Phone`, `Lock`, `ShieldCheck`). Each `<Input>` has a matching `<Label htmlFor>` so the test's `getByLabelText` works (label text must include "First name","Last name","Email","Phone","Password","Confirm","Captcha").

`src/app/(auth)/signup/page.tsx`:
```tsx
import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/signup-form';
export default function SignupPage() {
  return <main className="grid min-h-screen place-items-center p-6"><Suspense><SignupForm /></Suspense></main>;
}
```

- [ ] **Step 4: Run + commit**

Run: `bun run test -- signup-form` then `bun run test` and `bun run build`
Expected: PASS; build OK.
```bash
git add -A && git commit -m "feat: upgraded signup (names, +91 phone, confirm password, svg captcha)"
```

---

## Task 8: Login register-CTA + apply blocked-state

**Files:**
- Modify: `src/app/(auth)/login/page.tsx` (or the AuthForm) — prominent "New here? Create an account" → `/signup?next=…` (preserve `next`)
- Modify: `src/app/(portal)/apply/page.tsx` — active-application blocked state
- Test: (build-verified; logic covered by backend 409 test)

**Interfaces:**
- Consumes: `getSession`, `endpoints.myLoans` (server), `endpoints.publicConfig` (optional).
- Produces: login page shows a clear register link carrying `?next`. `/apply` server-checks the borrower's loans; if any is `APPLIED|SANCTIONED|DISBURSED`, renders an "application in progress (LMS-…)" Card with a `<Link className={buttonVariants()}` to `/my-loans` instead of the wizard.

- [ ] **Step 1: Login register CTA**

In the login page (or AuthForm's signup link), make the "Create an account" link prominent and carry `next`: `href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}`. (AuthForm already links to `/signup`; ensure it forwards `next`.)

- [ ] **Step 2: Apply blocked-state**

In `src/app/(portal)/apply/page.tsx`, before rendering `<ApplyWizard/>`, make it an async server component that fetches the borrower's loans:
```tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { endpoints } from '@/lib/api/endpoints';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplyWizard } from '@/components/wizard/apply-wizard';

export default async function ApplyPage() {
  const cookieHeader = (await cookies()).toString();
  let active: { loanRef: string } | undefined;
  try {
    const { data } = await endpoints.myLoans({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
    active = data.find((l) => ['APPLIED', 'SANCTIONED', 'DISBURSED'].includes(l.status));
  } catch { /* fall through to wizard */ }
  if (active) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader><CardTitle>Application in progress</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">You already have an active application ({active.loanRef}). You can apply again once it’s closed or rejected.</p>
          <Link href="/my-loans" className={buttonVariants()}>View my loans</Link>
        </CardContent>
      </Card>
    );
  }
  return <div><h1 className="mb-6 text-xl font-semibold">Apply for a loan</h1><ApplyWizard /></div>;
}
```

- [ ] **Step 3: Build + full suite**

Run: `bun run test` then `bun run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: login register CTA + apply blocked-state for active applications"
```

---

## Task 9: Icon/polish pass + final verification

**Files:**
- Modify: portal/dashboard headings to use lucide icons where natural (My Loans, dashboard nav, status rows) — minimal, no restructuring.

- [ ] **Step 1: Light icon pass**

Add lucide icons to the dashboard sidebar nav items (`Users`, `CheckCircle2`, `Banknote`, `Wallet`, `ShieldCheck`) and the My Loans / module headings. Keep it minimal — don't restructure components.

- [ ] **Step 2: Full suite + build**

Run: `bun run test` then `bun run build`
Expected: all green; build OK.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: lucide icon pass across nav and headings"
```

---

## Self-Review

**1. Spec coverage:** palette (Task 1) ✓ · API client captcha/config/track + signup body (Task 2) ✓ · analytics client + page tracker (Task 3) ✓ · marketing shell + estimate widget (Task 4) ✓ · smart Apply CTA routing (Task 5) ✓ · landing page sections + public config (Task 6) ✓ · signup uplift names/phone/confirm/captcha (Task 7) ✓ · login register CTA + apply blocked-state (Task 8) ✓ · icon/polish (Task 9) ✓.

**2. Placeholder scan:** Task 4 (navbar/footer) and Task 6 (landing sections) describe components in prose rather than full code because they're presentational layout with many lines — the implementer has the exact props, icons, data source, and section list. The interactive/logic-bearing pieces (EstimateWidget, ApplyCTA, SignupForm, analytics, apply blocked-state) have complete code + tests. No TODO/TBD.

**3. Type consistency:** `endpoints.getCaptcha/publicConfig/track/signup` signatures match across Tasks 2,4,5,6,7. `PublicConfig` shape consistent (Tasks 2,4,6). `ApplyCTA({me})` + `Navbar({me})` consume `Me` (Tasks 4,5). `calcRepayment(rupees,days)→{totalPaise}` reused (Task 4). The Slider array-value + `num()` guard matches the @base-ui fix used in the wizard. `cookies()` awaited everywhere (Task 8). The old `src/app/page.tsx` is removed so `/` resolves to `(marketing)/page.tsx` (Task 6) — no route collision.

**Cross-plan dependency:** consumes the backend Product v2 endpoints (`/auth/captcha`, `/public/config`, `/track`, the v2 signup body, the apply 409). Build/run the backend plan first.
