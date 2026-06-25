# v4 Phase 2 — Borrower Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v4 borrower experience — public product browsing (carousel → catalog → product detail with a live calculator), role-based login routing, borrower-only portal gating, and a My-Loans area that supports loan cancellation and read-only repayment tracking with document preview.

**Architecture:** Frontend-only changes in `/Users/gyankumar/Personal/LMS/lms-frontend` (Next 16 App Router). Browsing pages move to the public `(marketing)` group; operational actions stay guarded in `(portal)`. Login reads `me.role.code` to route borrowers vs ops. Consumes Phase-1 backend endpoints (cancel, borrower loan detail `{loan,payments}`, document presign) which are assumed to exist with the spec's shapes.

**Tech Stack:** Next.js 16, TypeScript strict, Tailwind, shadcn-on-@base-ui, lucide-react, sonner, Vitest+RTL, Bun.

## Global Constraints

- **Bun** everywhere: `bun add`, `bun run test <path>` (NEVER `bun test`), `bun run build`. Node 20 on PATH: `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"` first in every shell.
- **Next 16:** server pages/layouts are async; `cookies()`, `params`, `searchParams` are awaited; `useSearchParams` must be wrapped in `<Suspense>`.
- **@base-ui (NOT vanilla shadcn):** NO `asChild`/Slot — use `<Link className={buttonVariants()}>`; Slider value is an ARRAY (`value={[n]}`, `onValueChange` gets an array); Dialog uses the `render` prop (`<DialogTrigger render={<Button/>} />`); dropdowns use base-ui `Select`.
- **Frontend on port 3100.**
- **Money:** `formatRupees` expects **PAISE** (÷100); `formatRupeesAmount` expects **RUPEES**. Loan money fields (`principal`,`totalRepayment`,`amountPaid`,`outstanding`,`simpleInterest`) are **PAISE**. Payment `amount` and product money are **RUPEES**.
- **Tests:** Vitest + RTL; mock `next/navigation` and `@/lib/api/endpoints` via `vi.mock` with `vi.hoisted` for TDZ-safe mock vars.

---

### Task 1: Types + borrower endpoints (shared foundation)

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/lib/api/endpoints.ts`
- Test: `src/lib/api/__tests__/borrower-v4-endpoints.test.ts`

**Interfaces:**
- Consumes (Phase 1 backend): `POST /borrower/loans/:id/cancel` → `Loan`; `GET /borrower/loans/:id` → `{ loan: Loan; payments: Payment[] }`; `GET /borrower/loans/:id/document` → `{ url: string; filename: string; mime: string }`.
- Produces: `endpoints.cancelLoan(id, body?)`, `endpoints.myLoanDetail(id, opts?)`, `endpoints.borrowerDocument(id, opts?)`; types `BorrowerLoanDetail`, `DocumentRef`; `LoanStatus` includes `'CANCELLED'`; `LoanProduct.category?`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/__tests__/borrower-v4-endpoints.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../client', () => ({ apiFetch: fetchMock, ApiError: class extends Error {} }));
import { endpoints } from '../endpoints';

beforeEach(() => fetchMock.mockReset().mockResolvedValue({}));

describe('borrower v4 endpoints', () => {
  it('cancelLoan POSTs to the borrower cancel path', async () => {
    await endpoints.cancelLoan('L1', { reason: 'changed mind' });
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1/cancel', expect.objectContaining({ method: 'POST' }), undefined);
  });
  it('myLoanDetail GETs the borrower loan detail', async () => {
    await endpoints.myLoanDetail('L1');
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1', expect.objectContaining({ method: 'GET' }), undefined);
  });
  it('borrowerDocument GETs the document url', async () => {
    await endpoints.borrowerDocument('L1');
    expect(fetchMock).toHaveBeenCalledWith('/borrower/loans/L1/document', expect.objectContaining({ method: 'GET' }), undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/api/__tests__/borrower-v4-endpoints.test.ts`
Expected: FAIL — `endpoints.cancelLoan is not a function`.

- [ ] **Step 3: Extend the types**

In `src/types/api.ts`: change `LoanStatus` to include `'CANCELLED'`:
```ts
export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED' | 'CANCELLED';
```
Add `category?: string;` to the `LoanProduct` type. Add:
```ts
export type DocumentRef = { url: string; filename: string; mime: string };
export type BorrowerLoanDetail = { loan: Loan; payments: Payment[] };
```

- [ ] **Step 4: Add the endpoints**

In `src/lib/api/endpoints.ts`, inside the `endpoints` object (Borrower section), add:
```ts
  cancelLoan: (id: string, body?: { reason?: string }, opts?: Opts) =>
    post(`/borrower/loans/${id}/cancel`, body ?? {}, opts),
  myLoanDetail: (id: string, opts?: Opts) =>
    get<BorrowerLoanDetail>(`/borrower/loans/${id}`, opts),
  borrowerDocument: (id: string, opts?: Opts) =>
    get<DocumentRef>(`/borrower/loans/${id}/document`, opts),
```
Add `BorrowerLoanDetail, DocumentRef` to the `import type { ... } from '@/types/api'` line.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test src/lib/api/__tests__/borrower-v4-endpoints.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Build + commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): v4 borrower endpoints + CANCELLED status + product category type"
```

---

### Task 2: Ops-home helper + role-based login redirect

**Files:**
- Create: `src/lib/auth/ops-home.ts`
- Modify: `src/components/auth/auth-form.tsx`
- Test: `src/lib/auth/__tests__/ops-home.test.ts`
- Test: `src/components/auth/__tests__/auth-form-redirect.test.tsx`

**Interfaces:**
- Produces: `opsHome(permissions: string[]): string` — first ops section the user may see, default `/sanction`. Auth-form: after login, fetch `me`, route `BORROWER` → `next ?? '/'`, ops → `next ?? opsHome(me.permissions)`.

- [ ] **Step 1: Write the failing helper test**

```ts
// src/lib/auth/__tests__/ops-home.test.ts
import { describe, it, expect } from 'vitest';
import { opsHome } from '../ops-home';
describe('opsHome', () => {
  it('prefers Overview for metrics:read', () => {
    expect(opsHome(['metrics:read', 'loan:sanction'])).toBe('/admin/overview');
  });
  it('falls to the first permitted queue', () => {
    expect(opsHome(['loan:disburse'])).toBe('/disbursement');
  });
  it('defaults to /sanction when nothing matches', () => {
    expect(opsHome([])).toBe('/sanction');
  });
});
```

- [ ] **Step 2: Run it — FAIL** (`Cannot find module '../ops-home'`).

Run: `bun run test src/lib/auth/__tests__/ops-home.test.ts`

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/auth/ops-home.ts
const ORDER: { perm: string; href: string }[] = [
  { perm: 'metrics:read', href: '/admin/overview' },
  { perm: 'lead:read', href: '/sales' },
  { perm: 'loan:sanction', href: '/sanction' },
  { perm: 'loan:disburse', href: '/disbursement' },
  { perm: 'payment:create', href: '/collection' },
  { perm: 'loan:read:all', href: '/admin/loans' },
  { perm: 'product:manage', href: '/admin/products' },
  { perm: 'rbac:read', href: '/admin/roles' },
];
export function opsHome(permissions: string[]): string {
  const hit = ORDER.find((o) => permissions.includes(o.perm));
  return hit ? hit.href : '/sanction';
}
```

- [ ] **Step 4: Run it — PASS** (`bun run test src/lib/auth/__tests__/ops-home.test.ts`).

- [ ] **Step 5: Write the auth-form redirect test**

```tsx
// src/components/auth/__tests__/auth-form-redirect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { push, login, me, params } = vi.hoisted(() => ({
  push: vi.fn(), login: vi.fn(), me: vi.fn(), params: { get: vi.fn(() => null) },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }), useSearchParams: () => params }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { login, me } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { AuthForm } from '../auth-form';

beforeEach(() => { push.mockReset(); login.mockReset().mockResolvedValue(undefined); me.mockReset(); params.get.mockReturnValue(null); });

async function submit() {
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
}
describe('AuthForm role redirect', () => {
  it('sends a borrower to / by default', async () => {
    me.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: ['loan:apply'] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/');
  });
  it('sends an ops user to their ops home', async () => {
    me.mockResolvedValue({ role: { code: 'SANCTION' }, permissions: ['loan:sanction'] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/sanction');
  });
  it('honors an explicit next for both', async () => {
    params.get.mockReturnValue('/apply?product=PERSONAL');
    me.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: [] });
    render(<AuthForm mode="login" />); await submit();
    expect(push).toHaveBeenCalledWith('/apply?product=PERSONAL');
  });
});
```

- [ ] **Step 6: Run it — FAIL** (current form pushes `next ?? '/'` without role logic).

Run: `bun run test src/components/auth/__tests__/auth-form-redirect.test.tsx`

- [ ] **Step 7: Update auth-form**

In `src/components/auth/auth-form.tsx`, import `opsHome` and `endpoints`, and replace the post-login redirect block:
```tsx
import { opsHome } from '@/lib/auth/ops-home';
// ...in onSubmit, after await endpoints.login(values):
const next = params.get('next');
let me;
try { me = await endpoints.me(); } catch { me = null; }
const dest = next ?? (me && me.role.code !== 'BORROWER' ? opsHome(me.permissions) : '/');
router.push(dest);
router.refresh();
```
(Keep existing zod validation, sonner error toast, and the `me`/`endpoints` imports.)

- [ ] **Step 8: Run it — PASS** (`bun run test src/components/auth/__tests__/auth-form-redirect.test.tsx`).

- [ ] **Step 9: Build + commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): role-based login redirect (borrower vs ops) + opsHome helper"
```

---

### Task 3: Borrower-only gating on the (portal) group

**Files:**
- Modify: `src/app/(portal)/layout.tsx`
- Test: `src/app/(portal)/__tests__/layout-gate.test.tsx`

**Interfaces:**
- Consumes: `getSession()` (`Me | null`), `opsHome` from Task 2, `redirect` from `next/navigation`.
- Produces: `(portal)` pages (`/apply`, `/my-loans`) are borrower-only: anonymous → `/login?next=...` (existing), ops user → `opsHome(...)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(portal)/__tests__/layout-gate.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getSession, redirect } = vi.hoisted(() => ({ getSession: vi.fn(), redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));
vi.mock('@/lib/auth/session', () => ({ getSession }));
vi.mock('next/navigation', () => ({ redirect }));
import PortalLayout from '../layout';

beforeEach(() => { getSession.mockReset(); redirect.mockClear(); });
describe('(portal) layout gate', () => {
  it('redirects an ops user to their ops home', async () => {
    getSession.mockResolvedValue({ role: { code: 'SANCTION' }, permissions: ['loan:sanction'] });
    await expect(PortalLayout({ children: null })).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/sanction');
  });
  it('lets a borrower through', async () => {
    getSession.mockResolvedValue({ role: { code: 'BORROWER' }, permissions: ['loan:apply'] });
    await expect(PortalLayout({ children: null })).resolves.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it — FAIL** (current layout has no ops redirect).

Run: `bun run test "src/app/(portal)/__tests__/layout-gate.test.tsx"`

- [ ] **Step 3: Add the gate**

In `src/app/(portal)/layout.tsx`, after fetching the session:
```tsx
import { opsHome } from '@/lib/auth/ops-home';
// const me = await getSession();
if (!me) redirect('/login');
if (me.role.code !== 'BORROWER') redirect(opsHome(me.permissions));
```
(Keep rendering the existing `TopBar` + children for borrowers.)

- [ ] **Step 4: Run it — PASS** (`bun run test "src/app/(portal)/__tests__/layout-gate.test.tsx"`).

- [ ] **Step 5: Build + commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): gate (portal) group to borrowers (ops users redirected to ops home)"
```

---

### Task 4: Make catalog public + clickable ProductCard

**Files:**
- Move: `src/app/(portal)/products/page.tsx` → `src/app/(marketing)/products/page.tsx`
- Modify: `src/components/products/product-card.tsx`
- Test: `src/components/products/__tests__/product-card.test.tsx` (extend)

**Interfaces:**
- Consumes: `LoanProduct` (with `category?`), `endpoints.publicProducts()`.
- Produces: `/products` is a PUBLIC page (marketing group); `ProductCard` body links to `/products/${code}`, Apply button still links to `/apply?product=${code}`.

- [ ] **Step 1: Write the failing card test**

Extend `src/components/products/__tests__/product-card.test.tsx`:
```tsx
it('links the card body to the product detail page', () => {
  render(<ProductCard product={{ code: 'PERSONAL', name: 'Personal Loan', description: 'd', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' } as any} />);
  const detail = screen.getByRole('link', { name: /view details/i });
  expect(detail).toHaveAttribute('href', '/products/PERSONAL');
});
```

- [ ] **Step 2: Run it — FAIL** (no "view details" link yet).

Run: `bun run test src/components/products/__tests__/product-card.test.tsx`

- [ ] **Step 3: Add the detail link to ProductCard**

In `product-card.tsx`, wrap the card heading/body in a `<Link href={\`/products/${product.code}\`} className="...">` (use `buttonVariants({ variant: 'ghost' })` or a plain styled `<Link>`), with accessible text "View details". Keep the existing Apply `<Link href={\`/apply?product=${product.code}\`} className={buttonVariants()}>`.

- [ ] **Step 4: Move the catalog page to the public group**

Move the file (git mv) so `/products` is public:
```bash
git mv "src/app/(portal)/products/page.tsx" "src/app/(marketing)/products/page.tsx"
```
The page already fetches `endpoints.publicProducts()` server-side; no auth was required for the data. Ensure it imports remain valid after the move (relative `@/` aliases are unaffected).

- [ ] **Step 5: Run card test — PASS**; then `bun run build` to confirm the moved route compiles as a public page.

Run: `bun run test src/components/products/__tests__/product-card.test.tsx`

- [ ] **Step 6: Commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): public product catalog + clickable ProductCard detail link"
```

---

### Task 5: Product detail page with live calculator

**Files:**
- Create: `src/app/(marketing)/products/[code]/page.tsx`
- Create: `src/components/products/product-detail.tsx` (client — sliders + live calc)
- Test: `src/components/products/__tests__/product-detail.test.tsx`

**Interfaces:**
- Consumes: `endpoints.product(code)` (`LoanProduct`), `endpoints.me()`/session for guarded Apply, `calcRepayment(principalRupees, tenureDays, rate)`, `formatRupees(paise)`, base-ui `Slider` (array value).
- Produces: a public `/products/[code]` page showing name, category, max amount, eligibility, tenure, rate, description, a live repayment calculator, and a guarded Apply button.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/products/__tests__/product-detail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { ProductDetail } from '../product-detail';
const product = { code: 'PERSONAL', name: 'Personal Loan', category: 'Personal', description: 'desc', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' } as any;
describe('ProductDetail', () => {
  it('shows the key facts and a live total', () => {
    render(<ProductDetail product={product} me={null} />);
    expect(screen.getByText(/Personal Loan/)).toBeInTheDocument();
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    expect(screen.getByTestId('detail-total')).toBeInTheDocument();
  });
  it('recomputes the total when tenure changes', async () => {
    render(<ProductDetail product={product} me={null} />);
    const before = screen.getByTestId('detail-total').textContent;
    const tenure = screen.getByTestId('tenure-slider').querySelector('input')!;
    await userEvent.clear(tenure); // base-ui slider exposes a hidden input
    // fallback: fire change to max tenure
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(tenure, { target: { value: '365' } });
    expect(screen.getByTestId('detail-total').textContent).not.toBe(before);
  });
});
```

- [ ] **Step 2: Run it — FAIL** (`Cannot find module '../product-detail'`).

Run: `bun run test src/components/products/__tests__/product-detail.test.tsx`

- [ ] **Step 3: Implement `ProductDetail` (client)**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import type { LoanProduct, Me } from '@/types/api';

export function ProductDetail({ product, me }: { product: LoanProduct; me: Me | null }) {
  const router = useRouter();
  const [amt, setAmt] = useState(product.minPrincipal);
  const [ten, setTen] = useState(product.minTenureDays);
  const c = calcRepayment(amt, ten, product.interestRate);
  const num = (v: number | number[]) => (Array.isArray(v) ? v[0] : v);
  function apply() {
    if (!me) return router.push(`/login?next=/apply?product=${product.code}`);
    if (me.role.code === 'BORROWER') return router.push(`/apply?product=${product.code}`);
    router.push('/');
  }
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {product.category && <p className="text-sm text-muted-foreground">{product.category}</p>}
        <p className="text-sm">{product.interestRate}% p.a.</p>
      </header>
      <p className="text-muted-foreground">{product.description}</p>
      <ul className="grid grid-cols-2 gap-2 text-sm">
        <li>Max amount: {formatRupees(product.maxPrincipal * 100)}</li>
        <li>Tenure: {product.minTenureDays}–{product.maxTenureDays} days</li>
        <li>Age: {product.eligibility.minAge}–{product.eligibility.maxAge}</li>
        <li>Min salary: {formatRupees(product.eligibility.minMonthlySalary * 100)}/mo</li>
        <li className="col-span-2">Employment: {product.eligibility.employmentModes.join(', ')}</li>
      </ul>
      <Card><CardContent className="space-y-4 pt-6">
        <div data-testid="amount-slider">
          <label className="text-sm">Amount: {formatRupees(amt * 100)}</label>
          <Slider value={[amt]} min={product.minPrincipal} max={product.maxPrincipal} step={1000} onValueChange={(v) => setAmt(num(v))} />
        </div>
        <div data-testid="tenure-slider">
          <label className="text-sm">Tenure: {ten} days</label>
          <Slider value={[ten]} min={product.minTenureDays} max={product.maxTenureDays} step={1} onValueChange={(v) => setTen(num(v))} />
        </div>
        <p>Interest: {formatRupees(c.interestPaise)}</p>
        <p data-testid="detail-total" className="text-lg font-semibold">Total repayment: {formatRupees(c.totalPaise)}</p>
      </CardContent></Card>
      <Button onClick={apply}>Apply for this loan</Button>
    </div>
  );
}
```

- [ ] **Step 4: Implement the page (server, public, await params)**

```tsx
// src/app/(marketing)/products/[code]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { getSession } from '@/lib/auth/session';
import { ProductDetail } from '@/components/products/product-detail';

export default async function ProductDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cookieHeader = (await cookies()).toString();
  const me = await getSession();
  let product;
  try { product = await endpoints.product(code, { cookieHeader, serverBase: process.env.API_URL_INTERNAL }); }
  catch { notFound(); }
  return <div className="mx-auto max-w-3xl px-4 py-10"><ProductDetail product={product!} me={me} /></div>;
}
```

- [ ] **Step 5: Run test — PASS**; then `bun run build`.

Run: `bun run test src/components/products/__tests__/product-detail.test.tsx`

- [ ] **Step 6: Commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): public product detail page with live repayment calculator"
```

---

### Task 6: Landing carousel of active products

**Files:**
- Create: `src/components/marketing/product-carousel.tsx` (client)
- Modify: `src/app/(marketing)/page.tsx` (render carousel from `publicProducts`)
- Test: `src/components/marketing/__tests__/product-carousel.test.tsx`

**Interfaces:**
- Consumes: `LoanProduct[]`.
- Produces: `<ProductCarousel products={LoanProduct[]} />` — renders at most 5 product tiles (each links to `/products/${code}`) and a "See more loans" link to `/products`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/marketing/__tests__/product-carousel.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCarousel } from '../product-carousel';
const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ code: `P${i}`, name: `Loan ${i}`, interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: {}, status: 'ACTIVE' } as any));
describe('ProductCarousel', () => {
  it('renders at most 5 tiles and a see-more link', () => {
    render(<ProductCarousel products={mk(8)} />);
    expect(screen.getAllByTestId('carousel-tile')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /see more loans/i })).toHaveAttribute('href', '/products');
  });
  it('links each tile to its detail page', () => {
    render(<ProductCarousel products={mk(1)} />);
    expect(screen.getByRole('link', { name: /Loan 0/ })).toHaveAttribute('href', '/products/P0');
  });
});
```

- [ ] **Step 2: Run it — FAIL** (`Cannot find module '../product-carousel'`).

Run: `bun run test src/components/marketing/__tests__/product-carousel.test.tsx`

- [ ] **Step 3: Implement the carousel (CSS scroll-snap, no new dep)**

```tsx
'use client';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import type { LoanProduct } from '@/types/api';
import { formatRupees } from '@/lib/money';

export function ProductCarousel({ products }: { products: LoanProduct[] }) {
  const items = products.slice(0, 5);
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Available loans</h2>
        <Link href="/products" className="text-sm underline">See more loans</Link>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link key={p.code} href={`/products/${p.code}`} data-testid="carousel-tile"
            className="min-w-[240px] snap-start rounded-lg border p-4 hover:bg-accent">
            <Landmark className="mb-2 h-5 w-5 text-primary" />
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.interestRate}% p.a.</div>
            <div className="text-sm">{formatRupees(p.minPrincipal * 100)}–{formatRupees(p.maxPrincipal * 100)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire into the landing page**

In `src/app/(marketing)/page.tsx`, the page already fetches `publicProducts` (with fallback to `[]`). Render `<ProductCarousel products={products} />` near the top (after the hero, before/around the EstimateWidget).

- [ ] **Step 5: Run test — PASS**; then `bun run build`.

Run: `bun run test src/components/marketing/__tests__/product-carousel.test.tsx`

- [ ] **Step 6: Commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): landing carousel of active loan products (max 5 + see more)"
```

---

### Task 7: My-Loans cancel action + CANCELLED badge

**Files:**
- Modify: `src/components/common/status-badge.tsx` (add CANCELLED)
- Create: `src/components/borrower/cancel-loan-button.tsx` (client)
- Modify: `src/app/(portal)/my-loans/page.tsx` (render cancel button per loan)
- Test: `src/components/common/__tests__/status-badge.test.tsx` (extend)
- Test: `src/components/borrower/__tests__/cancel-loan-button.test.tsx`

**Interfaces:**
- Consumes: `endpoints.cancelLoan(id)`, base-ui Dialog (`render` prop), sonner `toast`, `useRouter`.
- Produces: `<CancelLoanButton loanId status />` — visible+enabled only for `APPLIED`/`SANCTIONED`; opens a confirm dialog; on confirm calls `cancelLoan` then `router.refresh()`. `StatusBadge` renders a grey `CANCELLED` badge.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/borrower/__tests__/cancel-loan-button.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { cancelLoan, refresh, toastSuccess } = vi.hoisted(() => ({ cancelLoan: vi.fn(), refresh: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { cancelLoan } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn() }) }));
import { CancelLoanButton } from '../cancel-loan-button';

beforeEach(() => { cancelLoan.mockReset().mockResolvedValue({}); refresh.mockReset(); });
describe('CancelLoanButton', () => {
  it('is not rendered for DISBURSED loans', () => {
    const { container } = render(<CancelLoanButton loanId="L1" status="DISBURSED" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('cancels an APPLIED loan after confirm', async () => {
    render(<CancelLoanButton loanId="L1" status="APPLIED" />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(cancelLoan).toHaveBeenCalledWith('L1');
    expect(refresh).toHaveBeenCalled();
  });
});
```

```tsx
// add to src/components/common/__tests__/status-badge.test.tsx
it('renders a CANCELLED badge', () => {
  render(<StatusBadge status="CANCELLED" />);
  expect(screen.getByText(/CANCELLED/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them — FAIL.**

Run: `bun run test src/components/borrower/__tests__/cancel-loan-button.test.tsx src/components/common/__tests__/status-badge.test.tsx`

- [ ] **Step 3: Add CANCELLED to StatusBadge**

In `status-badge.tsx` add `CANCELLED: 'bg-gray-100 text-gray-700'` (or palette equivalent) to the color map so `<StatusBadge status="CANCELLED" />` renders.

- [ ] **Step 4: Implement CancelLoanButton**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import type { LoanStatus } from '@/types/api';

const CANCELLABLE: LoanStatus[] = ['APPLIED', 'SANCTIONED'];
export function CancelLoanButton({ loanId, status }: { loanId: string; status: LoanStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!CANCELLABLE.includes(status)) return null;
  async function onConfirm() {
    setBusy(true);
    try { await endpoints.cancelLoan(loanId); toast.success('Loan cancelled'); router.refresh(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not cancel'); }
    finally { setBusy(false); }
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm">Cancel loan</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Cancel this loan?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This stops the application. You can re-apply later.</p>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Keep loan</Button>} />
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>Confirm cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
(If the project's Dialog export names differ, match them — base-ui Dialog uses `DialogTrigger render={...}`; confirm against `src/components/ui/dialog.tsx`.)

- [ ] **Step 5: Render it in My-Loans**

In `src/app/(portal)/my-loans/page.tsx`, inside each loan card's footer add `<CancelLoanButton loanId={loan._id} status={loan.status} />`. Make the loan card's title/ref a link to `/my-loans/${loan._id}` (Task 8 adds the detail page).

- [ ] **Step 6: Run tests — PASS**; then `bun run build`.

Run: `bun run test src/components/borrower/__tests__/cancel-loan-button.test.tsx src/components/common/__tests__/status-badge.test.tsx`

- [ ] **Step 7: Commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
bun run build && git add -A && git commit -m "feat(fe): cancel-loan action (APPLIED/SANCTIONED) + CANCELLED badge"
```

---

### Task 8: Borrower loan detail — repayment tracking + document + logout

**Files:**
- Create: `src/app/(portal)/my-loans/[id]/page.tsx` (server, await params)
- Create: `src/components/borrower/collections-table.tsx`
- Create: `src/components/borrower/document-link.tsx` (client — opens presigned url)
- Modify: borrower top bar component to add a Logout control (find via `(portal)/layout.tsx`'s `TopBar`)
- Test: `src/components/borrower/__tests__/collections-table.test.tsx`
- Test: `src/components/borrower/__tests__/document-link.test.tsx`

**Interfaces:**
- Consumes: `endpoints.myLoanDetail(id)` → `{loan, payments}`, `endpoints.borrowerDocument(id)` → `{url,filename,mime}`, `endpoints.logout()`, `formatRupees(paise)`, `formatRupeesAmount(rupees)`.
- Produces: `<CollectionsTable payments={Payment[]} totalRepayment={paise} />` — read-only table S.No · Date · UTR · Amount · Status · Running balance, deriving running outstanding and `SETTLED` on the entry that clears it; `<DocumentLink loanId />` — fetches the presigned URL on click and opens it. A logout control in the borrower top bar.

- [ ] **Step 1: Write the failing collections-table test**

```tsx
// src/components/borrower/__tests__/collections-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CollectionsTable } from '../collections-table';
// totalRepayment in PAISE; payment.amount in RUPEES
const payments = [
  { _id: 'p1', utr: 'U1', amount: 1000, paidAt: '2026-06-20T00:00:00Z' },
  { _id: 'p2', utr: 'U2', amount: 1039.45, paidAt: '2026-06-25T00:00:00Z' },
] as any;
describe('CollectionsTable', () => {
  it('renders rows with running balance and SETTLED on the final clearing entry', () => {
    // total = ₹2,039.45 = 203945 paise; two payments clear it
    render(<CollectionsTable payments={payments} totalRepayment={203945} />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('U1')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/RECEIVED/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/SETTLED/)).toBeInTheDocument();
    // running balance after final entry is ₹0
    expect(within(rows[1]).getByText('₹0')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — FAIL** (`Cannot find module '../collections-table'`).

Run: `bun run test src/components/borrower/__tests__/collections-table.test.tsx`

- [ ] **Step 3: Implement CollectionsTable**

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatRupees, formatRupeesAmount } from '@/lib/money';
import type { Payment } from '@/types/api';

export function CollectionsTable({ payments, totalRepayment }: { payments: Payment[]; totalRepayment: number }) {
  // totalRepayment is PAISE; payment.amount is RUPEES → convert to paise for running balance.
  let outstanding = totalRepayment;
  const rows = payments.map((p, i) => {
    outstanding -= Math.round(p.amount * 100);
    const status = outstanding <= 0 ? 'SETTLED' : 'RECEIVED';
    return { i: i + 1, p, balance: Math.max(0, outstanding), status };
  });
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>S.No</TableHead><TableHead>Date of Collection</TableHead><TableHead>UTR</TableHead>
        <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Running balance</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.p._id}>
            <TableCell>{r.i}</TableCell>
            <TableCell>{new Date(r.p.paidAt).toLocaleDateString('en-IN')}</TableCell>
            <TableCell>{r.p.utr}</TableCell>
            <TableCell>{formatRupeesAmount(r.p.amount)}</TableCell>
            <TableCell>{r.status}</TableCell>
            <TableCell>{formatRupees(r.balance)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run it — PASS** (`bun run test src/components/borrower/__tests__/collections-table.test.tsx`).

- [ ] **Step 5: Write the failing document-link test + implement**

```tsx
// src/components/borrower/__tests__/document-link.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const { borrowerDocument, openSpy } = vi.hoisted(() => ({ borrowerDocument: vi.fn(), openSpy: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { borrowerDocument } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { DocumentLink } from '../document-link';
beforeEach(() => { borrowerDocument.mockReset().mockResolvedValue({ url: 'http://x/doc.pdf', filename: 'doc.pdf', mime: 'application/pdf' }); (window as any).open = openSpy; openSpy.mockReset(); });
describe('DocumentLink', () => {
  it('fetches a presigned url and opens it', async () => {
    render(<DocumentLink loanId="L1" />);
    await userEvent.click(screen.getByRole('button', { name: /document/i }));
    expect(borrowerDocument).toHaveBeenCalledWith('L1');
    expect(openSpy).toHaveBeenCalledWith('http://x/doc.pdf', '_blank');
  });
});
```

```tsx
// src/components/borrower/document-link.tsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
export function DocumentLink({ loanId }: { loanId: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try { const d = await endpoints.borrowerDocument(loanId); window.open(d.url, '_blank'); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Document unavailable'); }
    finally { setBusy(false); }
  }
  return <Button variant="outline" size="sm" disabled={busy} onClick={open}>View document</Button>;
}
```

- [ ] **Step 6: Run document test — PASS** (`bun run test src/components/borrower/__tests__/document-link.test.tsx`).

- [ ] **Step 7: Build the borrower loan-detail page (server)**

```tsx
// src/app/(portal)/my-loans/[id]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { StatusBadge } from '@/components/common/status-badge';
import { CollectionsTable } from '@/components/borrower/collections-table';
import { DocumentLink } from '@/components/borrower/document-link';
import { CancelLoanButton } from '@/components/borrower/cancel-loan-button';
import { formatRupees } from '@/lib/money';

export default async function MyLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  let detail;
  try { detail = await endpoints.myLoanDetail(id, { cookieHeader, serverBase: process.env.API_URL_INTERNAL }); }
  catch { notFound(); }
  const { loan, payments } = detail!;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{loan.loanRef}</h1>
        <StatusBadge status={loan.status} />
        <CancelLoanButton loanId={loan._id} status={loan.status} />
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>Total: {formatRupees(loan.totalRepayment)}</div>
        <div>Paid: {formatRupees(loan.amountPaid)}</div>
        <div>Outstanding: {formatRupees(loan.outstanding)}</div>
      </div>
      <DocumentLink loanId={loan._id} />
      {(loan.status === 'DISBURSED' || loan.status === 'CLOSED') && (
        <section className="space-y-2">
          <h2 className="font-semibold">Collections</h2>
          <CollectionsTable payments={payments} totalRepayment={loan.totalRepayment} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add the Logout control to the borrower top bar**

Locate the borrower `TopBar` referenced by `src/app/(portal)/layout.tsx`. Add a client logout control (button) that calls `endpoints.logout()` then `router.push('/')`. If `TopBar` is a server component, add a small `'use client'` `LogoutButton` and render it inside. Example:
```tsx
// src/components/common/logout-button.tsx
'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
export function LogoutButton() {
  const router = useRouter();
  return <Button variant="ghost" size="sm" onClick={async () => { await endpoints.logout(); router.push('/'); router.refresh(); }}>Log out</Button>;
}
```
Render `<LogoutButton />` in the borrower TopBar.

- [ ] **Step 9: Run the borrower component tests + build**

Run: `bun run test src/components/borrower/__tests__/collections-table.test.tsx src/components/borrower/__tests__/document-link.test.tsx`
Then: `bun run build` (confirm `/my-loans/[id]` compiles).

- [ ] **Step 10: Commit**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
git add -A && git commit -m "feat(fe): borrower loan detail — collections table, document preview, logout"
```

---

### Task 9: Full borrower suite + build verification

**Files:**
- Test: run the entire frontend suite.

- [ ] **Step 1: Run the whole suite**

Run: `export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH" && bun run test`
Expected: all green (existing v1–v3 tests + the new v4 borrower tests).

- [ ] **Step 2: Production build**

Run: `bun run build`
Expected: clean compile; new routes present: `/products` (public), `/products/[code]`, `/my-loans/[id]`.

- [ ] **Step 3: Wiring check (manual read)**

Confirm: login redirects borrower vs ops (Task 2); `(portal)` blocks ops (Task 3); landing renders the carousel; catalog card → detail; detail live calc; my-loans cancel + collections table + document + logout; `CANCELLED` badge renders. No `'PERSONAL'` hardcode regressions; no `asChild`.

- [ ] **Step 4: Commit (if any wiring fixes were needed)**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
git add -A && git commit -m "test(fe): v4 borrower portal — full suite green + build verified" || echo "no changes"
```
