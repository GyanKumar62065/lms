# Product v3 — Part A Loan Products FRONTEND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the borrower-facing loan-product catalog, a product-scoped apply flow, an admin product-management screen, and a product-aware marketing estimate widget to the Next.js frontend.

**Architecture:** Consume the Part A backend product endpoints. Products are rupee-denominated at the API edge. A new portal catalog page lists active products; the apply wizard is driven by a selected product (bounds + rate come from the product, not hardcoded); a dashboard screen lets admins CRUD/activate/deactivate products; the landing estimate widget gains a product picker. Server pages fetch via `cookieHeader`/`serverBase`; interactive pieces are client components tested with Vitest + RTL using the `vi.hoisted` mock pattern.

**Tech Stack:** Next 16 App Router (TS strict), Tailwind, shadcn-on-@base-ui, react-hook-form + zod, lucide-react, sonner, Vitest + RTL, Bun.

## Global Constraints

- **Tooling:** Bun everywhere (`bun install`, `bun add`, `bunx`, `bun run <script>`). Tests via `bun run test <path>` (never `bun test`). Node 20 on PATH.
- **Next 16:** `cookies()`/`headers()` are async; server page `searchParams`/`params` are Promises (await them). `useSearchParams` must be wrapped in `<Suspense>`.
- **base-ui shadcn:** NO `asChild`/Slot — link-styled buttons use `<Link className={buttonVariants()}>`. `Slider` takes an **array** value (`value={[n]}`) and `onValueChange` receives an array. `Dialog` uses the `render` prop (`<DialogTrigger render={<Button />}>`). `Select` is `@base-ui` (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`); `Select.Root` takes `value`/`onValueChange`.
- **Money:** rupees at the edge. `LoanProduct` fields `minPrincipal`/`maxPrincipal`/`eligibility.minMonthlySalary` are **rupees**. Display via `formatRupees(paise)` from `@/lib/money` → pass `rupees * 100`.
- **Frontend runs on port 3100.**
- **RBAC (frontend):** server pages gate via `requirePermission('<perm>')` (`@/lib/auth/session`); the dashboard sidebar filters `NAV` by `permissions.includes(perm)`.
- **Tests:** mock `next/navigation`, `sonner`, and `@/lib/api/endpoints` with `vi.hoisted` (mock vars created in a `vi.hoisted(() => ({...}))` block to avoid hoisting TDZ). Import the component-under-test AFTER the `vi.mock` calls.

---

### Task 1: Product types + API endpoints

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/lib/api/endpoints.ts`
- Test: `src/lib/api/__tests__/product-endpoints.test.ts`

**Interfaces:**
- Consumes: `apiFetch` (`src/lib/api/client.ts`), the `post`/`put`/`get` helpers already in `endpoints.ts`.
- Produces:
  - Type `ProductEligibility = { minAge: number; maxAge: number; minMonthlySalary: number; employmentModes: string[] }`.
  - Type `LoanProduct = { _id: string; code: string; name: string; description: string; interestRate: number; minPrincipal: number; maxPrincipal: number; minTenureDays: number; maxTenureDays: number; eligibility: ProductEligibility; status: 'ACTIVE' | 'INACTIVE' }` (all money in rupees).
  - `endpoints.publicProducts(o?)` → `Promise<{ data: LoanProduct[] }>`
  - `endpoints.products(o?)` → `Promise<{ data: LoanProduct[] }>`
  - `endpoints.product(code, o?)` → `Promise<LoanProduct>`
  - `endpoints.createProduct(b)`, `endpoints.updateProduct(id, b)`, `endpoints.activateProduct(id)`, `endpoints.deactivateProduct(id)`
  - `endpoints.apply(b: { productCode: string; principal: number; tenureDays: number })` (productCode added).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/__tests__/product-endpoints.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('@/lib/api/client', () => ({ apiFetch, ApiError: class extends Error {} }));
import { endpoints } from '../endpoints';

beforeEach(() => apiFetch.mockClear());

describe('product endpoints', () => {
  it('publicProducts GETs /public/products', async () => {
    await endpoints.publicProducts();
    expect(apiFetch).toHaveBeenCalledWith('/public/products', { method: 'GET' }, undefined);
  });
  it('product(code) GETs /products/:code', async () => {
    await endpoints.product('PERSONAL');
    expect(apiFetch).toHaveBeenCalledWith('/products/PERSONAL', { method: 'GET' }, undefined);
  });
  it('createProduct POSTs /admin/products', async () => {
    await endpoints.createProduct({ code: 'X' });
    expect(apiFetch).toHaveBeenCalledWith('/admin/products', { method: 'POST', body: JSON.stringify({ code: 'X' }) }, undefined);
  });
  it('activateProduct POSTs /admin/products/:id/activate', async () => {
    await endpoints.activateProduct('id1');
    expect(apiFetch).toHaveBeenCalledWith('/admin/products/id1/activate', { method: 'POST', body: undefined }, undefined);
  });
  it('apply includes productCode', async () => {
    await endpoints.apply({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 });
    expect(apiFetch).toHaveBeenCalledWith('/borrower/loans', { method: 'POST', body: JSON.stringify({ productCode: 'PERSONAL', principal: 200000, tenureDays: 60 }) }, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/lib/api/__tests__/product-endpoints.test.ts`
Expected: FAIL — `endpoints.publicProducts is not a function`.

- [ ] **Step 3: Add the types**

Append to `src/types/api.ts`:

```ts
export type ProductEligibility = {
  minAge: number;
  maxAge: number;
  minMonthlySalary: number;
  employmentModes: string[];
};
export type LoanProduct = {
  _id: string;
  code: string;
  name: string;
  description: string;
  interestRate: number;
  minPrincipal: number;
  maxPrincipal: number;
  minTenureDays: number;
  maxTenureDays: number;
  eligibility: ProductEligibility;
  status: 'ACTIVE' | 'INACTIVE';
};
```

- [ ] **Step 4: Add the endpoints**

In `src/lib/api/endpoints.ts`, add `LoanProduct` to the type import, change `apply`, and add product functions:

```ts
import { Loan, Me, Paginated, Payment, Lead, RoleView, PublicConfig, LoanProduct } from '@/types/api';
```

Replace the `apply` line with:

```ts
  apply: (b: { productCode: string; principal: number; tenureDays: number }) => post('/borrower/loans', b) as Promise<Loan>,
```

Add before the closing `};` of `endpoints`:

```ts
  publicProducts: (o?: Opts) => get<{ data: LoanProduct[] }>('/public/products', o),
  products: (o?: Opts) => get<{ data: LoanProduct[] }>('/products', o),
  product: (code: string, o?: Opts) => get<LoanProduct>(`/products/${code}`, o),
  createProduct: (b: unknown) => post('/admin/products', b) as Promise<LoanProduct>,
  updateProduct: (id: string, b: unknown) => apiFetch(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(b) }) as Promise<LoanProduct>,
  activateProduct: (id: string) => post(`/admin/products/${id}/activate`) as Promise<LoanProduct>,
  deactivateProduct: (id: string) => post(`/admin/products/${id}/deactivate`) as Promise<LoanProduct>,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/lib/api/__tests__/product-endpoints.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/types/api.ts src/lib/api/endpoints.ts src/lib/api/__tests__/product-endpoints.test.ts
git commit -m "feat(fe): LoanProduct type + product endpoints, apply() takes productCode"
```

---

### Task 2: Borrower product catalog

**Files:**
- Create: `src/components/products/product-card.tsx`
- Create: `src/app/(portal)/products/page.tsx`
- Test: `src/components/products/__tests__/product-card.test.tsx`

**Interfaces:**
- Consumes: `LoanProduct` (Task 1), `endpoints.publicProducts` (Task 1), `formatRupees` (`@/lib/money`), `buttonVariants` (`@/components/ui/button`), `Card`/`CardHeader`/`CardTitle`/`CardContent`/`CardFooter` (`@/components/ui/card`).
- Produces: `ProductCard({ product }: { product: LoanProduct })` — a client component rendering name, rate, principal range, tenure range, and an "Apply" link to `/apply?product=<code>`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/products/__tests__/product-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '../product-card';
import type { LoanProduct } from '@/types/api';

const product: LoanProduct = {
  _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: 'Flexible cash',
  interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365,
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
  status: 'ACTIVE',
};

describe('ProductCard', () => {
  it('shows name, rate, ranges and links Apply to /apply?product=<code>', () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    const apply = screen.getByRole('link', { name: /apply/i });
    expect(apply).toHaveAttribute('href', '/apply?product=PERSONAL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/products/__tests__/product-card.test.tsx`
Expected: FAIL — cannot find `../product-card`.

- [ ] **Step 3: Implement ProductCard**

```tsx
// src/components/products/product-card.tsx
'use client';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

export function ProductCard({ product }: { product: LoanProduct }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Landmark size={18} />{product.name}</CardTitle>
        <p className="text-muted-foreground text-sm">{product.description}</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-1 text-sm">
        <div className="font-medium text-primary">{product.interestRate}% p.a.</div>
        <div className="text-muted-foreground">
          {formatRupees(product.minPrincipal * 100)} – {formatRupees(product.maxPrincipal * 100)}
        </div>
        <div className="text-muted-foreground">{product.minTenureDays}–{product.maxTenureDays} days</div>
      </CardContent>
      <CardFooter>
        <Link href={`/apply?product=${product.code}`} className={buttonVariants({ className: 'w-full' })}>
          Apply
        </Link>
      </CardFooter>
    </Card>
  );
}
```

- [ ] **Step 4: Implement the catalog page**

```tsx
// src/app/(portal)/products/page.tsx
import { cookies } from 'next/headers';
import { endpoints } from '@/lib/api/endpoints';
import { ProductCard } from '@/components/products/product-card';

export default async function ProductsPage() {
  const cookieHeader = (await cookies()).toString();
  let products = [] as Awaited<ReturnType<typeof endpoints.publicProducts>>['data'];
  try {
    products = (await endpoints.publicProducts({ cookieHeader, serverBase: process.env.API_URL_INTERNAL })).data;
  } catch { /* render empty state */ }
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Loan products</h1>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products are available right now. Please check back soon.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <ProductCard key={p.code} product={p} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/products/__tests__/product-card.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/products src/app/\(portal\)/products
git commit -m "feat(fe): borrower loan-product catalog page"
```

---

### Task 3: Product-scoped apply flow

**Files:**
- Modify: `src/components/wizard/apply-wizard.tsx`
- Modify: `src/components/wizard/step-config.tsx`
- Modify: `src/app/(portal)/apply/page.tsx`
- Test: `src/components/wizard/__tests__/step-config.test.tsx`
- Test: `src/components/wizard/__tests__/apply-wizard.test.tsx`

**Interfaces:**
- Consumes: `LoanProduct` (Task 1), `endpoints.apply`/`endpoints.publicProducts` (Task 1), `calcRepayment(principalRupees, tenureDays, rate)` (`@/lib/loan-calc`), `formatRupees`, `Slider` (array value), `Card`, `Button`.
- Produces:
  - `ApplyWizard({ products, initialProduct }: { products: LoanProduct[]; initialProduct?: LoanProduct })` — shows a product picker when no product is selected, otherwise runs Details → Slip → Config steps for the selected product.
  - `StepConfig({ product, onApplied }: { product: LoanProduct; onApplied: () => void })` — sliders bounded by the product, rate from the product, sends `{ productCode, principal, tenureDays }`.

- [ ] **Step 1: Write the failing StepConfig test**

```tsx
// src/components/wizard/__tests__/step-config.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push, refresh, apply, toastSuccess, toastError } = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), apply: vi.fn().mockResolvedValue({}), toastSuccess: vi.fn(), toastError: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { apply } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { StepConfig } from '../step-config';
import type { LoanProduct } from '@/types/api';

const product: LoanProduct = {
  _id: '1', code: 'SALARY_ADVANCE', name: 'Salary Advance', description: '',
  interestRate: 18, minPrincipal: 10000, maxPrincipal: 100000, minTenureDays: 7, maxTenureDays: 60,
  eligibility: { minAge: 21, maxAge: 55, minMonthlySalary: 15000, employmentModes: ['Salaried'] }, status: 'ACTIVE',
};
beforeEach(() => { push.mockClear(); apply.mockClear(); });

describe('StepConfig', () => {
  it('shows the product rate and submits productCode on apply', async () => {
    render(<StepConfig product={product} onApplied={() => {}} />);
    expect(screen.getByText(/18% p\.a\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /apply now/i }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ productCode: 'SALARY_ADVANCE' }));
    expect(push).toHaveBeenCalledWith('/my-loans');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/wizard/__tests__/step-config.test.tsx`
Expected: FAIL — `StepConfig` requires a `product` prop / rate text absent.

- [ ] **Step 3: Rewrite StepConfig to take a product**

```tsx
// src/components/wizard/step-config.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import type { LoanProduct } from '@/types/api';

export function StepConfig({ product, onApplied }: { product: LoanProduct; onApplied: () => void }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState(product.minPrincipal);
  const [tenure, setTenure] = useState(product.minTenureDays);
  const [busy, setBusy] = useState(false);
  const calc = calcRepayment(principal, tenure, product.interestRate);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

  const apply = async () => {
    setBusy(true);
    try {
      await endpoints.apply({ productCode: product.code, principal, tenureDays: tenure });
      toast.success('Application submitted');
      onApplied();
      router.push('/my-loans');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not apply');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Amount</span><span>{formatRupees(principal * 100)}</span></div>
          <Slider min={product.minPrincipal} max={product.maxPrincipal} step={1000} value={[principal]} onValueChange={(v) => setPrincipal(num(v))} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Tenure</span><span>{tenure} days</span></div>
          <Slider min={product.minTenureDays} max={product.maxTenureDays} step={1} value={[tenure]} onValueChange={(v) => setTenure(num(v))} />
        </div>
      </div>
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <Row label="Principal" value={formatRupees(calc.principalPaise)} testId="principal" />
          <Row label={`Interest (${product.interestRate}% p.a.)`} value={formatRupees(calc.interestPaise)} testId="interest" />
          <div className="border-t pt-2">
            <Row label="Total Repayment" value={formatRupees(calc.totalPaise)} testId="total-repayment" bold />
          </div>
          <Button className="mt-3 w-full" onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply Now'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, testId, bold }: { label: string; value: string; testId: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span data-testid={testId} className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run StepConfig test to verify it passes**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/wizard/__tests__/step-config.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing ApplyWizard picker test**

```tsx
// src/components/wizard/__tests__/apply-wizard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplyWizard } from '../apply-wizard';
import type { LoanProduct } from '@/types/api';

const products: LoanProduct[] = [
  { _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' },
];

describe('ApplyWizard', () => {
  it('shows a product picker when no product is selected', () => {
    render(<ApplyWizard products={products} />);
    expect(screen.getByText(/choose a loan product/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /personal loan/i })).toHaveAttribute('href', '/apply?product=PERSONAL');
  });
  it('starts the steps when a product is selected', () => {
    render(<ApplyWizard products={products} initialProduct={products[0]} />);
    expect(screen.queryByText(/choose a loan product/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/wizard/__tests__/apply-wizard.test.tsx`
Expected: FAIL — `ApplyWizard` ignores the new props.

- [ ] **Step 7: Rewrite ApplyWizard with picker + selected product**

```tsx
// src/components/wizard/apply-wizard.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Stepper } from './stepper';
import { StepDetails } from './step-details';
import { StepSlip } from './step-slip';
import { StepConfig } from './step-config';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

const STEPS = ['Product', 'Details', 'Salary Slip', 'Loan & Apply'];

export function ApplyWizard({ products, initialProduct }: { products: LoanProduct[]; initialProduct?: LoanProduct }) {
  const [product, setProduct] = useState<LoanProduct | undefined>(initialProduct);
  const [step, setStep] = useState(1);

  if (!product) {
    return (
      <div className="space-y-4">
        <h2 className="font-medium">Choose a loan product</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <Card key={p.code}>
              <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-primary font-medium">{p.interestRate}% p.a.</div>
                <div className="text-muted-foreground">{formatRupees(p.minPrincipal * 100)} – {formatRupees(p.maxPrincipal * 100)}</div>
                <div className="flex gap-2 pt-1">
                  <button className={buttonVariants({ size: 'sm' })} onClick={() => setProduct(p)}>Select</button>
                  <Link href={`/apply?product=${p.code}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Details</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Stepper steps={STEPS} current={step + 1} />
      {step === 1 && <StepDetails onPassed={() => setStep(2)} />}
      {step === 2 && <StepSlip onStaged={() => setStep(3)} />}
      {step === 3 && <StepConfig product={product} onApplied={() => {}} />}
    </div>
  );
}
```

- [ ] **Step 8: Update the apply page to pass products + per-product blocked state**

```tsx
// src/app/(portal)/apply/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { endpoints } from '@/lib/api/endpoints';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplyWizard } from '@/components/wizard/apply-wizard';

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: productCode } = await searchParams;
  const cookieHeader = (await cookies()).toString();
  const o = { cookieHeader, serverBase: process.env.API_URL_INTERNAL };

  let products: Awaited<ReturnType<typeof endpoints.publicProducts>>['data'] = [];
  try { products = (await endpoints.publicProducts(o)).data; } catch { /* empty */ }
  const initialProduct = productCode ? products.find((p) => p.code === productCode) : undefined;

  if (initialProduct) {
    try {
      const { data } = await endpoints.myLoans(o);
      const active = data.find((l) => ['APPLIED', 'SANCTIONED', 'DISBURSED'].includes(l.status) && l.productCode === initialProduct.code);
      if (active) {
        return (
          <Card className="mx-auto max-w-md">
            <CardHeader><CardTitle>Application in progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">You already have an active application for {initialProduct.name} ({active.loanRef}). You can apply again once it&apos;s closed or rejected.</p>
              <Link href="/my-loans" className={buttonVariants()}>View my loans</Link>
            </CardContent>
          </Card>
        );
      }
    } catch { /* fall through to wizard */ }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Apply for a loan</h1>
      <ApplyWizard products={products} initialProduct={initialProduct} />
    </div>
  );
}
```

Note: this references `l.productCode` — add `productCode?: string` and `productName?: string` to the `Loan` type in `src/types/api.ts` in this step.

```ts
// in src/types/api.ts, add to the Loan type:
  productCode?: string;
  productName?: string;
```

- [ ] **Step 9: Run both wizard tests + the type-check**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/wizard/ && bunx tsc --noEmit`
Expected: PASS (both test files); tsc clean.

- [ ] **Step 10: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/wizard src/app/\(portal\)/apply src/types/api.ts
git commit -m "feat(fe): product-scoped apply flow (picker + product-bounded config + per-product block)"
```

---

### Task 4: Admin product-management screen

**Files:**
- Create: `src/components/dashboard/product-form-dialog.tsx`
- Create: `src/components/dashboard/products-table.tsx`
- Create: `src/app/(dashboard)/admin/products/page.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`
- Test: `src/components/dashboard/__tests__/product-form-dialog.test.tsx`
- Test: `src/components/dashboard/__tests__/products-table.test.tsx`

**Interfaces:**
- Consumes: `LoanProduct` (Task 1), `endpoints.createProduct/updateProduct/activateProduct/deactivateProduct` (Task 1), `requirePermission` (`@/lib/auth/session`), `Dialog` (render prop), `Table`, `Badge`, react-hook-form + zod.
- Produces:
  - `ProductFormDialog({ product, trigger }: { product?: LoanProduct; trigger: ReactNode })` — create when `product` is undefined, edit otherwise (code field disabled on edit); validates min ≤ max and calls the right endpoint.
  - `ProductsTable({ products }: { products: LoanProduct[] })` — rows with status badge + activate/deactivate buttons + an edit `ProductFormDialog`.

- [ ] **Step 1: Write the failing ProductFormDialog test**

```tsx
// src/components/dashboard/__tests__/product-form-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createProduct, refresh, toastSuccess } = vi.hoisted(() => ({
  createProduct: vi.fn().mockResolvedValue({}), refresh: vi.fn(), toastSuccess: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { createProduct, updateProduct: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { ProductFormDialog } from '../product-form-dialog';
import { Button } from '@/components/ui/button';

beforeEach(() => createProduct.mockClear());

describe('ProductFormDialog (create)', () => {
  it('submits a new product with rupee bounds', async () => {
    render(<ProductFormDialog trigger={<Button>New</Button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.type(screen.getByLabelText(/code/i), 'GOLD');
    await userEvent.type(screen.getByLabelText(/^name/i), 'Gold Loan');
    await userEvent.type(screen.getByLabelText(/description/i), 'Against gold');
    await userEvent.type(screen.getByLabelText(/interest rate/i), '14');
    await userEvent.type(screen.getByLabelText(/min principal/i), '20000');
    await userEvent.type(screen.getByLabelText(/max principal/i), '300000');
    await userEvent.type(screen.getByLabelText(/min tenure/i), '15');
    await userEvent.type(screen.getByLabelText(/max tenure/i), '180');
    await userEvent.type(screen.getByLabelText(/min age/i), '21');
    await userEvent.type(screen.getByLabelText(/max age/i), '58');
    await userEvent.type(screen.getByLabelText(/min monthly salary/i), '20000');
    await userEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOLD', interestRate: 14, minPrincipal: 20000, maxPrincipal: 300000 }));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/dashboard/__tests__/product-form-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ProductFormDialog**

```tsx
// src/components/dashboard/product-form-dialog.tsx
'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LoanProduct } from '@/types/api';

const schema = z.object({
  code: z.string().min(1, 'Required').transform((s) => s.toUpperCase()),
  name: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  interestRate: z.coerce.number().min(0),
  minPrincipal: z.coerce.number().positive(),
  maxPrincipal: z.coerce.number().positive(),
  minTenureDays: z.coerce.number().int().positive(),
  maxTenureDays: z.coerce.number().int().positive(),
  minAge: z.coerce.number().int().positive(),
  maxAge: z.coerce.number().int().positive(),
  minMonthlySalary: z.coerce.number().positive(),
  employmentModes: z.string().min(1).default('Salaried,Self-Employed'),
}).refine((v) => v.maxPrincipal >= v.minPrincipal, { path: ['maxPrincipal'], message: 'Max must be ≥ min' })
  .refine((v) => v.maxTenureDays >= v.minTenureDays, { path: ['maxTenureDays'], message: 'Max must be ≥ min' })
  .refine((v) => v.maxAge >= v.minAge, { path: ['maxAge'], message: 'Max must be ≥ min' });

type FormValues = z.input<typeof schema>;

export function ProductFormDialog({ product, trigger }: { product?: LoanProduct; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const editing = Boolean(product);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product ? {
      code: product.code, name: product.name, description: product.description, interestRate: product.interestRate,
      minPrincipal: product.minPrincipal, maxPrincipal: product.maxPrincipal, minTenureDays: product.minTenureDays,
      maxTenureDays: product.maxTenureDays, minAge: product.eligibility.minAge, maxAge: product.eligibility.maxAge,
      minMonthlySalary: product.eligibility.minMonthlySalary, employmentModes: product.eligibility.employmentModes.join(','),
    } : undefined,
  });

  const onSubmit = handleSubmit(async (v) => {
    const body = {
      code: v.code, name: v.name, description: v.description, interestRate: Number(v.interestRate),
      minPrincipal: Number(v.minPrincipal), maxPrincipal: Number(v.maxPrincipal),
      minTenureDays: Number(v.minTenureDays), maxTenureDays: Number(v.maxTenureDays),
      eligibility: {
        minAge: Number(v.minAge), maxAge: Number(v.maxAge), minMonthlySalary: Number(v.minMonthlySalary),
        employmentModes: String(v.employmentModes).split(',').map((s) => s.trim()).filter(Boolean),
      },
    };
    try {
      if (editing && product) await endpoints.updateProduct(product._id, body);
      else await endpoints.createProduct(body);
      toast.success(editing ? 'Product updated' : 'Product created');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save product');
    }
  });

  const F = ({ id, label, type = 'text', disabled }: { id: keyof FormValues; label: string; type?: string; disabled?: boolean }) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} disabled={disabled} {...register(id)} />
      {errors[id] && <p className="text-sm text-destructive">{String(errors[id]?.message)}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <F id="code" label="Code" disabled={editing} />
          <F id="name" label="Name" />
          <div className="col-span-2"><F id="description" label="Description" /></div>
          <F id="interestRate" label="Interest rate (% p.a.)" type="number" />
          <F id="minMonthlySalary" label="Min monthly salary (₹)" type="number" />
          <F id="minPrincipal" label="Min principal (₹)" type="number" />
          <F id="maxPrincipal" label="Max principal (₹)" type="number" />
          <F id="minTenureDays" label="Min tenure (days)" type="number" />
          <F id="maxTenureDays" label="Max tenure (days)" type="number" />
          <F id="minAge" label="Min age" type="number" />
          <F id="maxAge" label="Max age" type="number" />
          <div className="col-span-2"><F id="employmentModes" label="Employment modes (comma-separated)" /></div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>Save product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the dialog test to verify it passes**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/dashboard/__tests__/product-form-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing ProductsTable test**

```tsx
// src/components/dashboard/__tests__/products-table.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { deactivateProduct, activateProduct, refresh } = vi.hoisted(() => ({
  deactivateProduct: vi.fn().mockResolvedValue({}), activateProduct: vi.fn().mockResolvedValue({}), refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { deactivateProduct, activateProduct, createProduct: vi.fn(), updateProduct: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ ApiError: class extends Error {} }));
import { ProductsTable } from '../products-table';
import type { LoanProduct } from '@/types/api';

const products: LoanProduct[] = [
  { _id: 'a', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] }, status: 'ACTIVE' },
];
beforeEach(() => deactivateProduct.mockClear());

describe('ProductsTable', () => {
  it('lists products and deactivates an active one', async () => {
    render(<ProductsTable products={products} />);
    expect(screen.getByText('PERSONAL')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /deactivate/i }));
    expect(deactivateProduct).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/dashboard/__tests__/products-table.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement ProductsTable**

```tsx
// src/components/dashboard/products-table.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductFormDialog } from './product-form-dialog';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

export function ProductsTable({ products }: { products: LoanProduct[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (p: LoanProduct) => {
    setBusy(p._id);
    try {
      if (p.status === 'ACTIVE') await endpoints.deactivateProduct(p._id);
      else await endpoints.activateProduct(p._id);
      toast.success('Updated');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Rate</TableHead>
          <TableHead>Principal</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p._id}>
            <TableCell className="font-mono text-xs">{p.code}</TableCell>
            <TableCell>{p.name}</TableCell>
            <TableCell>{p.interestRate}%</TableCell>
            <TableCell>{formatRupees(p.minPrincipal * 100)}–{formatRupees(p.maxPrincipal * 100)}</TableCell>
            <TableCell><Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
            <TableCell className="flex gap-2">
              <ProductFormDialog product={p} trigger={<Button size="sm" variant="outline">Edit</Button>} />
              <Button size="sm" variant={p.status === 'ACTIVE' ? 'destructive' : 'default'} disabled={busy === p._id} onClick={() => toggle(p)}>
                {p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 8: Implement the admin products page**

```tsx
// src/app/(dashboard)/admin/products/page.tsx
import { cookies } from 'next/headers';
import { Package } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { ProductsTable } from '@/components/dashboard/products-table';
import { ProductFormDialog } from '@/components/dashboard/product-form-dialog';

export default async function AdminProductsPage() {
  await requirePermission('product:manage');
  const cookieHeader = (await cookies()).toString();
  const { data } = await endpoints.products({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Package size={20} />Loan products</h1>
        <ProductFormDialog trigger={<Button size="sm">New product</Button>} />
      </div>
      <ProductsTable products={data} />
    </div>
  );
}
```

- [ ] **Step 9: Add the sidebar entry**

In `src/components/dashboard/sidebar.tsx`, add `Package` to the lucide import and a NAV entry:

```tsx
import { Users, CheckCircle2, Banknote, Wallet, ShieldCheck, Package, type LucideIcon } from 'lucide-react';
```

```tsx
  { href: '/admin/products', label: 'Products', perm: 'product:manage', Icon: Package },
```

(Place it just before the Roles entry.)

- [ ] **Step 10: Run the dashboard tests + type-check**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/dashboard/__tests__/product-form-dialog.test.tsx src/components/dashboard/__tests__/products-table.test.tsx && bunx tsc --noEmit`
Expected: PASS (both); tsc clean.

- [ ] **Step 11: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/dashboard/product-form-dialog.tsx src/components/dashboard/products-table.tsx src/components/dashboard/sidebar.tsx src/app/\(dashboard\)/admin/products src/components/dashboard/__tests__
git commit -m "feat(fe): admin product-management screen + sidebar entry"
```

---

### Task 5: Product-aware marketing estimate widget

**Files:**
- Modify: `src/components/marketing/estimate-widget.tsx`
- Test: `src/components/marketing/__tests__/estimate-widget.test.tsx`

**Interfaces:**
- Consumes: `LoanProduct` (Task 1), `PublicConfig` (`@/types/api`), `calcRepayment`, `Slider`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`.
- Produces: `EstimateWidget({ config, products }: { config: PublicConfig; products?: LoanProduct[] })` — when `products` is non-empty, shows a product `Select`; the chosen product drives the rate and slider bounds. Falls back to `config` when no products.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/marketing/__tests__/estimate-widget.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstimateWidget } from '../estimate-widget';
import type { PublicConfig, LoanProduct } from '@/types/api';

const config: PublicConfig = {
  loan: { minPrincipal: 50000, maxPrincipal: 500000, interestRate: 12, minTenureDays: 30, maxTenureDays: 365 },
  eligibility: { minAge: 23, maxAge: 50, minMonthlySalary: 25000, employmentModes: ['Salaried'] },
};
const products: LoanProduct[] = [
  { _id: '1', code: 'PERSONAL', name: 'Personal Loan', description: '', interestRate: 12, minPrincipal: 50000, maxPrincipal: 500000, minTenureDays: 30, maxTenureDays: 365, eligibility: config.eligibility, status: 'ACTIVE' },
  { _id: '2', code: 'SALARY_ADVANCE', name: 'Salary Advance', description: '', interestRate: 18, minPrincipal: 10000, maxPrincipal: 100000, minTenureDays: 7, maxTenureDays: 60, eligibility: config.eligibility, status: 'ACTIVE' },
];

describe('EstimateWidget', () => {
  it('falls back to config rate when no products', () => {
    render(<EstimateWidget config={config} />);
    expect(screen.getByText(/12% p\.a\./)).toBeInTheDocument();
    expect(screen.getByTestId('estimate-total')).toBeInTheDocument();
  });
  it('shows a product selector when products are provided', () => {
    render(<EstimateWidget config={config} products={products} />);
    expect(screen.getByText(/Personal Loan/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test src/components/marketing/__tests__/estimate-widget.test.tsx`
Expected: FAIL — widget has no `products` prop / no selector.

- [ ] **Step 3: Rewrite EstimateWidget**

```tsx
// src/components/marketing/estimate-widget.tsx
'use client';
import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import type { PublicConfig, LoanProduct } from '@/types/api';

export function EstimateWidget({ config, products }: { config: PublicConfig; products?: LoanProduct[] }) {
  const hasProducts = Boolean(products && products.length);
  const [code, setCode] = useState(products?.[0]?.code ?? '');
  const selected = useMemo(() => products?.find((p) => p.code === code), [products, code]);

  const bounds = selected
    ? { min: selected.minPrincipal, max: selected.maxPrincipal, minT: selected.minTenureDays, maxT: selected.maxTenureDays, rate: selected.interestRate }
    : { min: config.loan.minPrincipal, max: config.loan.maxPrincipal, minT: config.loan.minTenureDays, maxT: config.loan.maxTenureDays, rate: config.loan.interestRate };

  const [amt, setAmt] = useState(bounds.min);
  const [ten, setTen] = useState(bounds.minT);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));
  const clampedAmt = Math.min(Math.max(amt, bounds.min), bounds.max);
  const clampedTen = Math.min(Math.max(ten, bounds.minT), bounds.maxT);
  const c = calcRepayment(clampedAmt, clampedTen, bounds.rate);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {hasProducts && (
          <Select value={code} onValueChange={(v) => setCode(String(v))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a product" /></SelectTrigger>
            <SelectContent>
              {products!.map((p) => <SelectItem key={p.code} value={p.code}>{p.name} — {p.interestRate}%</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Amount</span><span>{formatRupees(clampedAmt * 100)}</span></div>
          <Slider min={bounds.min} max={bounds.max} step={1000} value={[clampedAmt]} onValueChange={(v) => setAmt(num(v))} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Tenure</span><span>{clampedTen} days</span></div>
          <Slider min={bounds.minT} max={bounds.maxT} step={1} value={[clampedTen]} onValueChange={(v) => setTen(num(v))} />
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm">Total repayment ({bounds.rate}% p.a.)</span>
          <span data-testid="estimate-total" className="text-xl font-semibold">{formatRupees(c.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Wire products into the landing page (best-effort fetch)**

In the marketing landing page (`src/app/(marketing)/page.tsx`), fetch products alongside the existing `publicConfig` and pass them to `EstimateWidget`. Keep the existing `publicConfig` fetch as the fallback so the page never hard-fails:

```tsx
// inside the landing page server component, near the existing publicConfig fetch:
let products: Awaited<ReturnType<typeof endpoints.publicProducts>>['data'] = [];
try { products = (await endpoints.publicProducts({ serverBase: process.env.API_URL_INTERNAL })).data; } catch { /* fallback to config */ }
// ...
<EstimateWidget config={config} products={products} />
```

(If the landing page is not already importing `endpoints`, add `import { endpoints } from '@/lib/api/endpoints';`. Leave all other landing markup unchanged.)

- [ ] **Step 5: Run the widget test + full suite + type-check**

Run: `cd /Users/gyankumar/Personal/LMS/lms-frontend && export PATH=/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH && bun run test && bunx tsc --noEmit`
Expected: PASS — all suites green (including the pre-existing v1/v2 tests); tsc clean.

- [ ] **Step 6: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/marketing/estimate-widget.tsx src/components/marketing/__tests__/estimate-widget.test.tsx src/app/\(marketing\)/page.tsx
git commit -m "feat(fe): product-aware estimate widget with product picker + config fallback"
```

---

## Notes for the implementer

- The landing page may already have its own `EstimateWidget` test (`estimate-total` testid). If a pre-existing test breaks because the widget signature changed, update it to pass `config` only (the `products` prop is optional) — do not delete coverage.
- `bunx tsc --noEmit` after each task catches base-ui prop-type drift early (e.g. `DialogTrigger render` expects a single React element).
- If `Select`'s `onValueChange` value type is `unknown` under strict TS, coerce with `String(v)` as shown.
- Do not touch Part B files (overview/charts/loans-list/loan-detail). Loan-type fields `productCode`/`productName` added here are also consumed by Part B — that is intentional shared surface.
