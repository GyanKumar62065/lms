# Product v3 — Part B Admin Dashboard FRONTEND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin portfolio dashboard UI — KPI cards, Recharts charts, a per-product breakdown table, a filterable loans list, and a per-loan audit-trail detail page — on top of the Part B backend endpoints.

**Architecture:** Next 16 App Router server pages fetch data server-side (cookies + internal API base) and pass plain data to small client components. Charts are client components wrapping Recharts and reading the existing `--chart-1..5` oklch tokens. Filtering is URL-driven: the server page reads `searchParams`, fetches filtered loans, and passes current filter values to a client `LoansFilterBar` that navigates via `useRouter.push`. The audit timeline reuses an extended `LoanTimeline`.

**Tech Stack:** Next 16 (App Router, async `cookies()`/`params`/`searchParams`), TypeScript strict, Tailwind, shadcn-on-@base-ui, lucide-react, **Recharts**, Vitest + React Testing Library.

## Global Constraints

- **Tooling:** **Bun** everywhere (`bun install`, `bun add`, `bunx`, `bun run <script>`). Run tests with `bun run test` (never `bun test`). Node 20 must be on PATH (`export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"`).
- **Next 16:** `cookies()`, `params`, and `searchParams` are **async** (await them). `useSearchParams` requires a Suspense boundary — this plan avoids it in client components by passing current filter values as props from the server page.
- **base-ui shadcn:** NO `asChild`/Slot → link-styled buttons use `<Link className={buttonVariants({ ... })}>`. `Slider` takes an **array** value (`value={[n]}`). `Dialog` uses the `render` prop. `Select` is from `@/components/ui/select` (base-ui) — controlled via `value`/`onValueChange`, items are `<SelectItem value=...>`.
- **Charts:** **Recharts only**. Chart series colors come from `var(--chart-1)`…`var(--chart-5)` (defined in `src/app/globals.css`). No other chart library.
- **Money:** all money crossing the API is in **rupees** already (the backend serializes paise→rupees). Render with `formatRupees` from `@/lib/money` **only for paise values**; metrics/loan money fields from the backend are rupees → render with a plain `₹` + `toLocaleString('en-IN')` helper (added in Task 2). Do not double-divide.
- **Port:** frontend runs on **3100**.
- **RBAC:** server pages gate with `requirePermission('<perm>')` from `@/lib/auth/session`; the sidebar filters entries by `permissions.includes(perm)`.
- **Backwards compatibility:** existing dashboard pages (`/sanction`, `/disbursement`, `/collection`, `/sales`, `/admin/roles`) and their components keep working. `LoansTable` gains columns but legacy/ops uses still render.

---

### Task 1: Recharts install + chart primitives

**Files:**
- Modify: `lms-frontend/package.json` (via `bun add recharts`)
- Create: `lms-frontend/src/components/dashboard/charts/chart-colors.ts`
- Create: `lms-frontend/src/components/dashboard/charts/chart-container.tsx`
- Test: `lms-frontend/src/components/dashboard/charts/__tests__/chart-container.test.tsx`

**Interfaces:**
- Produces:
  - `CHART_COLORS: string[]` — `['var(--chart-1)', … 'var(--chart-5)']`.
  - `chartColor(i: number): string` — cycles through `CHART_COLORS`.
  - `ChartContainer({ title, children, testId }): JSX` — a `Card`-wrapped, fixed-height (`h-72`) `ResponsiveContainer` host with an accessible heading. In jsdom `ResponsiveContainer` reports 0×0, so consumers' tests mock `recharts`; this component itself is tested only for the heading + wrapper.

- [ ] **Step 1: Install Recharts**

```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/gyankumar/Personal/LMS/lms-frontend
bun add recharts
```
Expected: `recharts` added to `package.json` dependencies; `bun.lock` updated.

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/dashboard/charts/__tests__/chart-container.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartContainer } from '../chart-container';
import { CHART_COLORS, chartColor } from '../chart-colors';

describe('ChartContainer', () => {
  it('renders its title and children host', () => {
    render(<ChartContainer title="Loans by status" testId="donut"><div /></ChartContainer>);
    expect(screen.getByText('Loans by status')).toBeInTheDocument();
    expect(screen.getByTestId('donut')).toBeInTheDocument();
  });
  it('chartColor cycles through the 5 theme tokens', () => {
    expect(CHART_COLORS).toHaveLength(5);
    expect(chartColor(0)).toBe('var(--chart-1)');
    expect(chartColor(5)).toBe('var(--chart-1)');
    expect(chartColor(6)).toBe('var(--chart-2)');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test src/components/dashboard/charts/__tests__/chart-container.test.tsx`
Expected: FAIL — cannot resolve `../chart-container` / `../chart-colors`.

- [ ] **Step 4: Implement chart-colors.ts**

```ts
// src/components/dashboard/charts/chart-colors.ts
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export function chartColor(i: number): string {
  return CHART_COLORS[((i % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length];
}
```

- [ ] **Step 5: Implement chart-container.tsx**

```tsx
// src/components/dashboard/charts/chart-container.tsx
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ChartContainer({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div data-testid={testId} className="h-72 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test src/components/dashboard/charts/__tests__/chart-container.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add package.json bun.lock src/components/dashboard/charts/chart-colors.ts src/components/dashboard/charts/chart-container.tsx src/components/dashboard/charts/__tests__/chart-container.test.tsx
git commit -m "feat(dashboard): add recharts + chart container/color primitives"
```

---

### Task 2: Types + endpoints (metrics, filtered loans, loan detail)

**Files:**
- Modify: `lms-frontend/src/types/api.ts`
- Modify: `lms-frontend/src/lib/api/endpoints.ts`
- Modify: `lms-frontend/src/lib/money.ts` (add `formatRupeesAmount` for rupee values)
- Test: `lms-frontend/src/lib/api/__tests__/endpoints-v3.test.ts`

**Interfaces:**
- Consumes (from Part B backend): `GET /admin/metrics` → `AdminMetrics`; `GET /loans?<filters>` → `Paginated<Loan>`; `GET /loans/:id` → `LoanDetail`.
- Produces:
  - `AdminMetrics` type (matches spec B1).
  - `LoanFilters` type and `endpoints.loans(filters?, o?)` (back-compat: still callable as before but now takes a filters object — see migration note).
  - `endpoints.adminMetrics(o?)`, `endpoints.loanDetail(id, o?)`.
  - `Loan` extended with optional `productCode?`, `productName?`, `disbursement?: { at?: string }`.
  - `formatRupeesAmount(rupees: number): string`.

> **Migration note — `endpoints.loans` signature change.** Today `loans(status?: string, o?)` is called in `sanction/page.tsx`, `disbursement/page.tsx`, `collection/page.tsx`. This task changes it to `loans(filters?: LoanFilters, o?)`. Update those three callers from `endpoints.loans('APPLIED', { … })` to `endpoints.loans({ status: 'APPLIED' }, { … })`. (Mirror the v2 `signupBorrower` cascade lesson: one signature, all callers updated in this task.)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/__tests__/endpoints-v3.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endpoints } from '../endpoints';

beforeEach(() => { vi.restoreAllMocks(); vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api/api/v1'); });

function stubJson(payload: unknown) {
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal('fetch', f);
  return f;
}

describe('v3 endpoints', () => {
  it('adminMetrics hits /admin/metrics', async () => {
    const f = stubJson({ kpis: {} });
    await endpoints.adminMetrics();
    expect(f.mock.calls[0][0]).toContain('/admin/metrics');
  });
  it('loanDetail hits /loans/:id', async () => {
    const f = stubJson({ _id: 'L1' });
    await endpoints.loanDetail('L1');
    expect(f.mock.calls[0][0]).toContain('/loans/L1');
  });
  it('loans builds a query string from filters (skips empty values)', async () => {
    const f = stubJson({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
    await endpoints.loans({ status: 'DISBURSED', productCode: 'PERSONAL', q: 'rahul', minAmount: 50000, sort: '-createdAt', page: 2 });
    const url = f.mock.calls[0][0] as string;
    expect(url).toContain('/loans?');
    expect(url).toContain('status=DISBURSED');
    expect(url).toContain('productCode=PERSONAL');
    expect(url).toContain('q=rahul');
    expect(url).toContain('minAmount=50000');
    expect(url).toContain('sort=-createdAt');
    expect(url).toContain('page=2');
    expect(url).not.toContain('maxAmount');
  });
  it('loans with no filters hits bare /loans', async () => {
    const f = stubJson({ data: [], pagination: { page: 1, limit: 20, total: 0 } });
    await endpoints.loans();
    expect(f.mock.calls[0][0]).toMatch(/\/loans$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/api/__tests__/endpoints-v3.test.ts`
Expected: FAIL — `endpoints.adminMetrics`/`loanDetail` undefined and `loans` ignores filters.

- [ ] **Step 3: Add types to `src/types/api.ts`**

Append:

```ts
export type AdminMetrics = {
  kpis: {
    totalDisbursed: number;
    totalRecovered: number;
    outstandingBook: number;
    activeLoans: number;
    totalApplications: number;
    approvalRate: number;     // 0..1
    rejectedCount: number;
    rejectionRate: number;    // 0..1
    avgTicketSize: number;
  };
  byStatus: { status: LoanStatus; count: number }[];
  funnel: { applied: number; sanctioned: number; disbursed: number; closed: number; rejected: number };
  timeSeries: { month: string; disbursed: number; recovered: number }[];
  byProduct: {
    productCode: string;
    productName: string;
    applicants: number;
    borrowed: number;
    recovered: number;
    outstanding: number;
    active: number;
    rejected: number;
    approvalRate: number;     // 0..1
  }[];
};

export type TimelineEntry = {
  type: 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED' | 'PAYMENT';
  at: string;
  actor: { id: string; name: string } | null;
  detail?: string;
};

export type LoanDetail = Loan & {
  payments: Payment[];
  timeline: TimelineEntry[];
};

export type LoanFilters = {
  status?: string;
  productCode?: string;
  from?: string;
  to?: string;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  page?: number;
  limit?: number;
};
```

Also extend the existing `Loan` type — add these optional fields inside the `Loan` object literal:

```ts
  productCode?: string;
  productName?: string;
  disbursement?: { at?: string };
```

- [ ] **Step 4: Add `formatRupeesAmount` to `src/lib/money.ts`**

```ts
// append to src/lib/money.ts
// For money values the backend already returns in rupees (not paise).
export function formatRupeesAmount(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
```

- [ ] **Step 5: Update `endpoints.ts`**

Replace the `loans` line and add the new endpoints. Update the import to include the new types:

```ts
import { Loan, Me, Paginated, Payment, Lead, RoleView, PublicConfig, AdminMetrics, LoanDetail, LoanFilters } from '@/types/api';
```

Replace `loans:` with a filters-aware version and add `adminMetrics`/`loanDetail` next to it:

```ts
  loans: (filters: LoanFilters = {}, o?: Opts) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return get<Paginated<Loan>>(`/loans${q ? `?${q}` : ''}`, o);
  },
  loan: (id: string, o?: Opts) => get<Loan>(`/loans/${id}`, o),
  loanDetail: (id: string, o?: Opts) => get<LoanDetail>(`/loans/${id}`, o),
  adminMetrics: (o?: Opts) => get<AdminMetrics>('/admin/metrics', o),
```

- [ ] **Step 6: Update the three existing callers**

In `src/app/(dashboard)/sanction/page.tsx`, `disbursement/page.tsx`, `collection/page.tsx`, change each `endpoints.loans('STATUS', { … })` to `endpoints.loans({ status: 'STATUS' }, { … })`:
- sanction: `endpoints.loans({ status: 'APPLIED' }, { cookieHeader, serverBase: process.env.API_URL_INTERNAL })`
- disbursement: `endpoints.loans({ status: 'SANCTIONED' }, …)`
- collection: `endpoints.loans({ status: 'DISBURSED' }, …)`

(Open each file and confirm the exact status string it currently passes; keep that status.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test src/lib/api/__tests__/endpoints-v3.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Run the existing endpoints test to confirm no regression**

Run: `bun run test src/lib/api/__tests__/endpoints-v2.test.ts`
Expected: PASS (unchanged).

- [ ] **Step 9: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/types/api.ts src/lib/api/endpoints.ts src/lib/money.ts src/app/\(dashboard\)/sanction/page.tsx src/app/\(dashboard\)/disbursement/page.tsx src/app/\(dashboard\)/collection/page.tsx src/lib/api/__tests__/endpoints-v3.test.ts
git commit -m "feat(api): admin metrics + filtered loans + loan detail endpoints and types"
```

---

### Task 3: KPI cards

**Files:**
- Create: `lms-frontend/src/components/dashboard/kpi-cards.tsx`
- Test: `lms-frontend/src/components/dashboard/__tests__/kpi-cards.test.tsx`

**Interfaces:**
- Consumes: `AdminMetrics['kpis']`, `formatRupeesAmount`.
- Produces: `KpiCards({ kpis }: { kpis: AdminMetrics['kpis'] }): JSX` — a responsive grid of 8 `Card`s with lucide icons. Money KPIs use `formatRupeesAmount`; rates render as `(value*100).toFixed(1)%`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/dashboard/__tests__/kpi-cards.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCards } from '../kpi-cards';

const kpis = {
  totalDisbursed: 700000, totalRecovered: 250000, outstandingBook: 450000,
  activeLoans: 3, totalApplications: 10, approvalRate: 0.6,
  rejectedCount: 2, rejectionRate: 0.2, avgTicketSize: 233333,
};

describe('KpiCards', () => {
  it('renders money KPIs in rupees and rates as percentages', () => {
    render(<KpiCards kpis={kpis} />);
    expect(screen.getByText('Total Disbursed')).toBeInTheDocument();
    expect(screen.getByText('₹7,00,000')).toBeInTheDocument();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Approval Rate')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/dashboard/__tests__/kpi-cards.test.tsx`
Expected: FAIL — cannot resolve `../kpi-cards`.

- [ ] **Step 3: Implement `kpi-cards.tsx`**

```tsx
// src/components/dashboard/kpi-cards.tsx
import { Banknote, TrendingUp, Wallet, Activity, FileText, CheckCircle2, XCircle, Receipt, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminMetrics } from '@/types/api';
import { formatRupeesAmount } from '@/lib/money';

function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }

export function KpiCards({ kpis }: { kpis: AdminMetrics['kpis'] }) {
  const items: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: 'Total Disbursed', value: formatRupeesAmount(kpis.totalDisbursed), Icon: Banknote },
    { label: 'Total Recovered', value: formatRupeesAmount(kpis.totalRecovered), Icon: TrendingUp },
    { label: 'Outstanding Book', value: formatRupeesAmount(kpis.outstandingBook), Icon: Wallet },
    { label: 'Active Loans', value: String(kpis.activeLoans), Icon: Activity },
    { label: 'Total Applications', value: String(kpis.totalApplications), Icon: FileText },
    { label: 'Approval Rate', value: pct(kpis.approvalRate), Icon: CheckCircle2 },
    { label: 'Rejected', value: `${kpis.rejectedCount} (${pct(kpis.rejectionRate)})`, Icon: XCircle },
    { label: 'Avg Ticket Size', value: formatRupeesAmount(kpis.avgTicketSize), Icon: Receipt },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, Icon }) => (
        <Card key={label} size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon size={16} />{label}
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/dashboard/__tests__/kpi-cards.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/dashboard/kpi-cards.tsx src/components/dashboard/__tests__/kpi-cards.test.tsx
git commit -m "feat(dashboard): KPI cards grid"
```

---

### Task 4: Chart components + per-product table

**Files:**
- Create: `lms-frontend/src/components/dashboard/charts/status-donut.tsx`
- Create: `lms-frontend/src/components/dashboard/charts/funnel-bar.tsx`
- Create: `lms-frontend/src/components/dashboard/charts/recovery-timeseries.tsx`
- Create: `lms-frontend/src/components/dashboard/charts/product-bars.tsx`
- Create: `lms-frontend/src/components/dashboard/product-breakdown-table.tsx`
- Test: `lms-frontend/src/components/dashboard/charts/__tests__/charts.test.tsx`
- Test: `lms-frontend/src/components/dashboard/__tests__/product-breakdown-table.test.tsx`

**Interfaces:**
- Consumes: `AdminMetrics` slices (`byStatus`, `funnel`, `timeSeries`, `byProduct`), `chartColor`, `ChartContainer`, `formatRupeesAmount`.
- Produces: four client chart components (`StatusDonut`, `FunnelBar`, `RecoveryTimeSeries`, `ProductBars`) each accepting its data slice, and `ProductBreakdownTable({ rows }: { rows: AdminMetrics['byProduct'] })`.

> **jsdom note:** Recharts' `ResponsiveContainer` measures to 0×0 under jsdom and renders nothing. Tests mock `recharts` so `ResponsiveContainer` renders children in a fixed-size div; the charts then render SVG. Tests assert the component mounts (its `ChartContainer` testId is present) rather than pixel geometry. The per-product **table** is plain DOM and is asserted on content.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/dashboard/charts/__tests__/charts.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 800, height: 300 }}>{children}</div>
  ) };
});

import { StatusDonut } from '../status-donut';
import { FunnelBar } from '../funnel-bar';
import { RecoveryTimeSeries } from '../recovery-timeseries';
import { ProductBars } from '../product-bars';

describe('dashboard charts mount', () => {
  it('StatusDonut renders its container', () => {
    render(<StatusDonut data={[{ status: 'APPLIED', count: 4 }, { status: 'CLOSED', count: 1 }] as any} />);
    expect(screen.getByTestId('chart-status-donut')).toBeInTheDocument();
  });
  it('FunnelBar renders its container', () => {
    render(<FunnelBar funnel={{ applied: 10, sanctioned: 6, disbursed: 4, closed: 1, rejected: 2 }} />);
    expect(screen.getByTestId('chart-funnel')).toBeInTheDocument();
  });
  it('RecoveryTimeSeries renders its container', () => {
    render(<RecoveryTimeSeries data={[{ month: '2026-05', disbursed: 100, recovered: 40 }]} />);
    expect(screen.getByTestId('chart-timeseries')).toBeInTheDocument();
  });
  it('ProductBars renders its container', () => {
    render(<ProductBars data={[{ productCode: 'PERSONAL', productName: 'Personal', borrowed: 500, recovered: 200 } as any]} />);
    expect(screen.getByTestId('chart-product-bars')).toBeInTheDocument();
  });
});
```

```tsx
// src/components/dashboard/__tests__/product-breakdown-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductBreakdownTable } from '../product-breakdown-table';

const rows = [{
  productCode: 'PERSONAL', productName: 'Personal Loan', applicants: 5, borrowed: 700000,
  recovered: 250000, outstanding: 450000, active: 3, rejected: 1, approvalRate: 0.8,
}];

describe('ProductBreakdownTable', () => {
  it('renders a row per product with money and rate formatting', () => {
    render(<ProductBreakdownTable rows={rows} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText('₹7,00,000')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });
  it('shows an empty state when there are no products', () => {
    render(<ProductBreakdownTable rows={[]} />);
    expect(screen.getByText(/no product activity/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/dashboard/charts/__tests__/charts.test.tsx src/components/dashboard/__tests__/product-breakdown-table.test.tsx`
Expected: FAIL — components do not exist.

- [ ] **Step 3: Implement `status-donut.tsx`**

```tsx
// src/components/dashboard/charts/status-donut.tsx
'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function StatusDonut({ data }: { data: AdminMetrics['byStatus'] }) {
  return (
    <ChartContainer title="Loans by status" testId="chart-status-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {data.map((d, i) => <Cell key={d.status} fill={chartColor(i)} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 4: Implement `funnel-bar.tsx`**

```tsx
// src/components/dashboard/charts/funnel-bar.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function FunnelBar({ funnel }: { funnel: AdminMetrics['funnel'] }) {
  const data = [
    { stage: 'Applied', value: funnel.applied },
    { stage: 'Sanctioned', value: funnel.sanctioned },
    { stage: 'Disbursed', value: funnel.disbursed },
    { stage: 'Closed', value: funnel.closed },
    { stage: 'Rejected', value: funnel.rejected },
  ];
  return (
    <ChartContainer title="Application funnel" testId="chart-funnel">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="stage" width={80} />
          <Tooltip />
          <Bar dataKey="value" radius={4}>
            {data.map((d, i) => <Cell key={d.stage} fill={chartColor(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 5: Implement `recovery-timeseries.tsx`**

```tsx
// src/components/dashboard/charts/recovery-timeseries.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function RecoveryTimeSeries({ data }: { data: AdminMetrics['timeSeries'] }) {
  return (
    <ChartContainer title="Disbursed vs recovered (monthly)" testId="chart-timeseries">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="disbursed" name="Disbursed" fill={chartColor(0)} radius={4} />
          <Bar dataKey="recovered" name="Recovered" fill={chartColor(1)} radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 6: Implement `product-bars.tsx`**

```tsx
// src/components/dashboard/charts/product-bars.tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './chart-container';
import { chartColor } from './chart-colors';
import { AdminMetrics } from '@/types/api';

export function ProductBars({ data }: { data: AdminMetrics['byProduct'] }) {
  return (
    <ChartContainer title="Per-product: borrowed vs recovered" testId="chart-product-bars">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="productName" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="borrowed" name="Borrowed" fill={chartColor(0)} radius={4} />
          <Bar dataKey="recovered" name="Recovered" fill={chartColor(1)} radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
```

- [ ] **Step 7: Implement `product-breakdown-table.tsx`**

```tsx
// src/components/dashboard/product-breakdown-table.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminMetrics } from '@/types/api';
import { formatRupeesAmount } from '@/lib/money';

function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }

export function ProductBreakdownTable({ rows }: { rows: AdminMetrics['byProduct'] }) {
  if (rows.length === 0) return <p className="text-muted-foreground">No product activity yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Applicants</TableHead>
          <TableHead>Borrowed</TableHead>
          <TableHead>Recovered</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Rejected</TableHead>
          <TableHead>Approval</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productCode}>
            <TableCell className="font-medium">{r.productName}</TableCell>
            <TableCell>{r.applicants}</TableCell>
            <TableCell>{formatRupeesAmount(r.borrowed)}</TableCell>
            <TableCell>{formatRupeesAmount(r.recovered)}</TableCell>
            <TableCell>{formatRupeesAmount(r.outstanding)}</TableCell>
            <TableCell>{r.active}</TableCell>
            <TableCell>{r.rejected}</TableCell>
            <TableCell>{pct(r.approvalRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `bun run test src/components/dashboard/charts/__tests__/charts.test.tsx src/components/dashboard/__tests__/product-breakdown-table.test.tsx`
Expected: PASS (4 + 2 tests).

- [ ] **Step 9: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/dashboard/charts/status-donut.tsx src/components/dashboard/charts/funnel-bar.tsx src/components/dashboard/charts/recovery-timeseries.tsx src/components/dashboard/charts/product-bars.tsx src/components/dashboard/product-breakdown-table.tsx src/components/dashboard/charts/__tests__/charts.test.tsx src/components/dashboard/__tests__/product-breakdown-table.test.tsx
git commit -m "feat(dashboard): status donut, funnel, timeseries, product bars + breakdown table"
```

---

### Task 5: Overview page + sidebar entries

**Files:**
- Create: `lms-frontend/src/app/(dashboard)/admin/overview/page.tsx`
- Modify: `lms-frontend/src/components/dashboard/sidebar.tsx`
- Test: `lms-frontend/src/components/dashboard/__tests__/sidebar.test.tsx` (extend)

**Interfaces:**
- Consumes: `endpoints.adminMetrics`, `requirePermission('metrics:read')`, `KpiCards`, the four chart components, `ProductBreakdownTable`.
- Produces: the `/admin/overview` route; sidebar entries for Overview (first), Loans, and Products (the Products entry belongs to Part A — only add it here if Part A hasn't; otherwise leave Part A's entry intact and just prepend Overview + add Loans).

> **Sidebar ordering:** final `NAV` order — Overview (`metrics:read`), then the existing Sales/Sanction/Disbursement/Collection, then Loans (`loan:read:all`), Products (`product:manage`, from Part A), Roles (`rbac:read`). Add Overview and Loans in this task; do not remove Part A's Products entry if present.

- [ ] **Step 1: Write the failing test (sidebar)**

Extend `sidebar.test.tsx` with:

```tsx
  it('shows Overview and Loans for an admin with metrics + loan read', () => {
    render(<Sidebar permissions={['metrics:read', 'loan:read:all']} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Loans')).toBeInTheDocument();
  });
  it('hides Overview without metrics:read', () => {
    render(<Sidebar permissions={['loan:sanction']} />);
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/dashboard/__tests__/sidebar.test.tsx`
Expected: FAIL — no "Overview"/"Loans" entries.

- [ ] **Step 3: Update `sidebar.tsx` NAV**

Add icons to the import and entries to `NAV`:

```tsx
import { Users, CheckCircle2, Banknote, Wallet, ShieldCheck, LayoutDashboard, ListChecks, type LucideIcon } from 'lucide-react';
```

```tsx
const NAV: { href: string; label: string; perm: string; Icon: LucideIcon }[] = [
  { href: '/admin/overview', label: 'Overview', perm: 'metrics:read', Icon: LayoutDashboard },
  { href: '/sales', label: 'Sales', perm: 'lead:read', Icon: Users },
  { href: '/sanction', label: 'Sanction', perm: 'loan:sanction', Icon: CheckCircle2 },
  { href: '/disbursement', label: 'Disbursement', perm: 'loan:disburse', Icon: Banknote },
  { href: '/collection', label: 'Collection', perm: 'payment:create', Icon: Wallet },
  { href: '/admin/loans', label: 'Loans', perm: 'loan:read:all', Icon: ListChecks },
  { href: '/admin/roles', label: 'Roles', perm: 'rbac:read', Icon: ShieldCheck },
];
```

(If Part A already added a Products entry, keep it — insert it before Roles. Do not duplicate.)

> **Active-highlight caveat:** the sidebar marks an item active with `pathname.startsWith(href)`. `/admin/loans` is not a prefix of `/admin/overview` (and vice-versa), and `/admin/roles` is distinct, so the existing logic is safe. No change needed.

- [ ] **Step 4: Run sidebar test to verify it passes**

Run: `bun run test src/components/dashboard/__tests__/sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the overview page**

```tsx
// src/app/(dashboard)/admin/overview/page.tsx
import { cookies } from 'next/headers';
import { LayoutDashboard } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { StatusDonut } from '@/components/dashboard/charts/status-donut';
import { FunnelBar } from '@/components/dashboard/charts/funnel-bar';
import { RecoveryTimeSeries } from '@/components/dashboard/charts/recovery-timeseries';
import { ProductBars } from '@/components/dashboard/charts/product-bars';
import { ProductBreakdownTable } from '@/components/dashboard/product-breakdown-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function OverviewPage() {
  await requirePermission('metrics:read');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const m = await endpoints.adminMetrics({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><LayoutDashboard size={20} />Portfolio Overview</h1>
      <KpiCards kpis={m.kpis} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelBar funnel={m.funnel} />
        <StatusDonut data={m.byStatus} />
        <RecoveryTimeSeries data={m.timeSeries} />
        <ProductBars data={m.byProduct} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Per-product performance</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto"><ProductBreakdownTable rows={m.byProduct} /></CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Build to verify the server page type-checks**

Run: `bun run build`
Expected: build succeeds (the `/admin/overview` route compiles). If it fails on missing types, fix imports before proceeding.

- [ ] **Step 7: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/app/\(dashboard\)/admin/overview/page.tsx src/components/dashboard/sidebar.tsx src/components/dashboard/__tests__/sidebar.test.tsx
git commit -m "feat(dashboard): admin overview page + Overview/Loans sidebar entries"
```

---

### Task 6: Loans list page + filter bar + extended LoansTable

**Files:**
- Modify: `lms-frontend/src/components/dashboard/loans-table.tsx`
- Create: `lms-frontend/src/components/dashboard/loans-filter-bar.tsx`
- Create: `lms-frontend/src/app/(dashboard)/admin/loans/page.tsx`
- Test: `lms-frontend/src/components/dashboard/__tests__/loans-filter-bar.test.tsx`
- Test: `lms-frontend/src/components/dashboard/__tests__/loans-table.test.tsx`

**Interfaces:**
- Consumes: `endpoints.loans(filters, o)`, `endpoints.products(o)` (Part A, for the product Select; if unavailable, the page falls back to a free-text product code input — but Part A is built first, so `products()` exists), `requirePermission('loan:read:all')`.
- Produces:
  - `LoansTable` extended with optional `linkBase?: string` (when set, the Loan Ref cell links to `${linkBase}/${loan._id}`) and three new columns: Product, Outstanding, Disbursed.
  - `LoansFilterBar({ current }: { current: LoanFilters })` — client component; on change, builds a query string and `router.push('/admin/loans?' + qs)`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/dashboard/__tests__/loans-table.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoansTable } from '../loans-table';

const loans = [{
  _id: 'L1', loanRef: 'LMS-2026-000001', borrower: { _id: 'u1', fullName: 'Rahul Kumar', email: 'r@x.com' },
  principal: 200000, tenureDays: 60, interestRate: 12, simpleInterest: 3945, totalRepayment: 203945,
  amountPaid: 0, outstanding: 203945, status: 'DISBURSED', productName: 'Personal Loan',
  disbursement: { at: '2026-06-20T00:00:00.000Z' }, statusHistory: [], createdAt: '2026-06-19T00:00:00.000Z',
}] as any;

describe('LoansTable', () => {
  it('renders product, outstanding and disbursed columns', () => {
    render(<LoansTable loans={loans} />);
    expect(screen.getByText('Personal Loan')).toBeInTheDocument();
    expect(screen.getByText('₹2,03,945')).toBeInTheDocument(); // outstanding (paise → formatRupees)
    expect(screen.getByText('Product')).toBeInTheDocument();
  });
  it('links the loan ref when linkBase is set', () => {
    render(<LoansTable loans={loans} linkBase="/admin/loans" />);
    const link = screen.getByRole('link', { name: 'LMS-2026-000001' });
    expect(link).toHaveAttribute('href', '/admin/loans/L1');
  });
});
```

```tsx
// src/components/dashboard/__tests__/loans-filter-bar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/endpoints', () => ({ endpoints: { products: vi.fn() } }));
import { LoansFilterBar } from '../loans-filter-bar';

beforeEach(() => push.mockClear());

describe('LoansFilterBar', () => {
  it('pushes a query string with the typed search term', async () => {
    render(<LoansFilterBar current={{}} products={[]} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'rahul');
    await userEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('q=rahul'));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/admin/loans?'));
  });
  it('clear resets to the bare route', async () => {
    render(<LoansFilterBar current={{ q: 'rahul' }} products={[]} />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(push).toHaveBeenCalledWith('/admin/loans');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/dashboard/__tests__/loans-table.test.tsx src/components/dashboard/__tests__/loans-filter-bar.test.tsx`
Expected: FAIL — new columns/props and `loans-filter-bar` missing.

- [ ] **Step 3: Extend `loans-table.tsx`**

```tsx
import * as React from 'react';
import Link from 'next/link';
import { Loan } from '@/types/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/common/status-badge';
import { formatRupees } from '@/lib/money';

export function LoansTable({
  loans,
  renderActions,
  linkBase,
}: {
  loans: Loan[];
  renderActions?: (loan: Loan) => React.ReactNode;
  linkBase?: string;
}) {
  if (loans.length === 0) {
    return <p className="text-muted-foreground">Nothing in this queue.</p>;
  }
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN') : '—');
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Loan Ref</TableHead>
          <TableHead>Borrower</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Principal</TableHead>
          <TableHead>Tenure</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Disbursed</TableHead>
          <TableHead>Status</TableHead>
          {renderActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => {
          const borrower = typeof loan.borrower === 'object' ? loan.borrower.fullName : '—';
          return (
            <TableRow key={loan._id}>
              <TableCell className="font-medium">
                {linkBase ? <Link className="underline" href={`${linkBase}/${loan._id}`}>{loan.loanRef}</Link> : loan.loanRef}
              </TableCell>
              <TableCell>{borrower}</TableCell>
              <TableCell>{loan.productName ?? '—'}</TableCell>
              <TableCell>{formatRupees(loan.principal)}</TableCell>
              <TableCell>{loan.tenureDays}d</TableCell>
              <TableCell>{formatRupees(loan.outstanding)}</TableCell>
              <TableCell>{fmtDate(loan.disbursement?.at)}</TableCell>
              <TableCell><StatusBadge status={loan.status} /></TableCell>
              {renderActions && <TableCell>{renderActions(loan)}</TableCell>}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Implement `loans-filter-bar.tsx`**

```tsx
// src/components/dashboard/loans-filter-bar.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoanFilters, LoanProduct } from '@/types/api';

const STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'];

export function LoansFilterBar({ current, products }: { current: LoanFilters; products: LoanProduct[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(current.status ?? '');
  const [productCode, setProductCode] = useState(current.productCode ?? '');
  const [q, setQ] = useState(current.q ?? '');
  const [from, setFrom] = useState(current.from ?? '');
  const [to, setTo] = useState(current.to ?? '');
  const [minAmount, setMinAmount] = useState(current.minAmount?.toString() ?? '');
  const [maxAmount, setMaxAmount] = useState(current.maxAmount?.toString() ?? '');

  function apply() {
    const qs = new URLSearchParams();
    const set = (k: string, v: string) => { if (v) qs.set(k, v); };
    set('status', status); set('productCode', productCode); set('q', q.trim());
    set('from', from); set('to', to); set('minAmount', minAmount); set('maxAmount', maxAmount);
    const s = qs.toString();
    router.push(s ? `/admin/loans?${s}` : '/admin/loans');
  }
  function clear() { router.push('/admin/loans'); }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-3 lg:grid-cols-4">
      <div className="space-y-1">
        <Label>Search</Label>
        <Input placeholder="Search ref, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Product</Label>
        <Select value={productCode} onValueChange={setProductCode}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Any product" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any product</SelectItem>
            {products.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Min ₹</Label><Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} /></div>
        <div className="space-y-1"><Label>Max ₹</Label><Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div>
      </div>
      <div className="flex items-end gap-2">
        <Button onClick={apply}>Apply</Button>
        <Button variant="outline" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
```

> **Select empty-value note:** base-ui `Select` accepts `value=""` for an "Any" item; the page treats empty as "filter absent". If the installed base-ui version rejects an empty `SelectItem` value at runtime, substitute the sentinel `'ALL'` and map it to "absent" in both `apply()` and the server page. Verify against the actual component when implementing; keep the test's behavior (no `status`/`productCode` key when "Any") intact.

- [ ] **Step 5: Implement the loans list page**

```tsx
// src/app/(dashboard)/admin/loans/page.tsx
import { cookies } from 'next/headers';
import { ListChecks } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LoansTable } from '@/components/dashboard/loans-table';
import { LoansFilterBar } from '@/components/dashboard/loans-filter-bar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { LoanFilters } from '@/types/api';

export default async function AdminLoansPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission('loan:read:all');
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const o = { cookieHeader, serverBase: process.env.API_URL_INTERNAL };

  const page = Number(sp.page ?? '1') || 1;
  const filters: LoanFilters = {
    status: sp.status, productCode: sp.productCode, q: sp.q, from: sp.from, to: sp.to,
    minAmount: sp.minAmount ? Number(sp.minAmount) : undefined,
    maxAmount: sp.maxAmount ? Number(sp.maxAmount) : undefined,
    sort: sp.sort ?? '-createdAt', page, limit: 20,
  };

  const [{ data, pagination }, products] = await Promise.all([
    endpoints.loans(filters, o),
    endpoints.products(o).catch(() => [] as never),
  ]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const qsFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: String(p) })) if (v) qs.set(k, String(v));
    return `/admin/loans?${qs.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><ListChecks size={20} />All Loans</h1>
      <LoansFilterBar current={filters} products={products} />
      <div className="overflow-x-auto"><LoansTable loans={data} linkBase="/admin/loans" /></div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {pagination.page} of {totalPages} · {pagination.total} loans</span>
        <div className="flex gap-2">
          {page > 1 && <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={qsFor(page - 1)}>Previous</Link>}
          {page < totalPages && <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={qsFor(page + 1)}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
```

> **Type note:** `endpoints.products` returns `LoanProduct[]` (Part A). If Part A typed it as `Paginated<LoanProduct>` instead, adapt the destructure accordingly when implementing — check `endpoints.products`'s actual return type and match it.

- [ ] **Step 6: Run the component tests to verify they pass**

Run: `bun run test src/components/dashboard/__tests__/loans-table.test.tsx src/components/dashboard/__tests__/loans-filter-bar.test.tsx`
Expected: PASS (2 + 2 tests).

- [ ] **Step 7: Build to verify the page type-checks**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/dashboard/loans-table.tsx src/components/dashboard/loans-filter-bar.tsx src/app/\(dashboard\)/admin/loans/page.tsx src/components/dashboard/__tests__/loans-table.test.tsx src/components/dashboard/__tests__/loans-filter-bar.test.tsx
git commit -m "feat(dashboard): filterable admin loans list + extended loans table"
```

---

### Task 7: Loan detail page + extended audit timeline

**Files:**
- Modify: `lms-frontend/src/components/common/loan-timeline.tsx`
- Create: `lms-frontend/src/app/(dashboard)/admin/loans/[id]/page.tsx`
- Test: `lms-frontend/src/components/common/__tests__/loan-timeline.test.tsx`

**Interfaces:**
- Consumes: `endpoints.loanDetail(id, o)`, `requirePermission('loan:read:all')`, `LoanDetail`, `TimelineEntry`, `formatRupees`.
- Produces: `LoanTimeline` extended to accept an optional `entries?: TimelineEntry[]`. When `entries` is provided, render the audit list (each row: type, actor name or "system", formatted timestamp, detail). When absent, fall back to the existing status-flow rendering (back-compat for borrower `my-loans`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/common/__tests__/loan-timeline.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoanTimeline } from '../loan-timeline';

describe('LoanTimeline', () => {
  it('falls back to the status flow when no entries are given', () => {
    render(<LoanTimeline status="DISBURSED" />);
    expect(screen.getByText('APPLIED')).toBeInTheDocument();
    expect(screen.getByText('DISBURSED')).toBeInTheDocument();
  });
  it('renders an audit list with actor and detail when entries are given', () => {
    render(<LoanTimeline status="CLOSED" entries={[
      { type: 'APPLIED', at: '2026-06-19T10:00:00.000Z', actor: { id: 'u1', name: 'Rahul Kumar' } },
      { type: 'SANCTIONED', at: '2026-06-20T10:00:00.000Z', actor: { id: 's1', name: 'Sanction Exec' }, detail: 'Approved' },
      { type: 'PAYMENT', at: '2026-06-25T10:00:00.000Z', actor: { id: 'c1', name: 'Collection Exec' }, detail: '₹2,03,945 · UTR V2-1' },
    ]} />);
    expect(screen.getByText(/Rahul Kumar/)).toBeInTheDocument();
    expect(screen.getByText(/Sanction Exec/)).toBeInTheDocument();
    expect(screen.getByText(/UTR V2-1/)).toBeInTheDocument();
    expect(screen.getByText('SANCTIONED')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/common/__tests__/loan-timeline.test.tsx`
Expected: FAIL — `entries` prop not supported.

- [ ] **Step 3: Extend `loan-timeline.tsx`**

```tsx
// src/components/common/loan-timeline.tsx
import { LoanStatus, TimelineEntry } from '@/types/api';
import { cn } from '@/lib/utils';

const FLOW: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED', 'CLOSED'];

function StatusFlow({ status }: { status: LoanStatus }) {
  if (status === 'REJECTED') {
    return <p className="text-sm font-medium text-red-700">APPLIED → REJECTED</p>;
  }
  const idx = FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1 text-xs">
      {FLOW.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={cn('rounded px-2 py-0.5', i <= idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{s}</span>
          {i < FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

export function LoanTimeline({ status, entries }: { status: LoanStatus; entries?: TimelineEntry[] }) {
  if (!entries) return <StatusFlow status={status} />;
  const fmt = (s: string) => new Date(s).toLocaleString('en-IN');
  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{e.type}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(e.at)} · {e.actor ? e.actor.name : 'system'}{e.detail ? ` · ${e.detail}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/components/common/__tests__/loan-timeline.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the loan detail page**

```tsx
// src/app/(dashboard)/admin/loans/[id]/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/status-badge';
import { LoanTimeline } from '@/components/common/loan-timeline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRupees } from '@/lib/money';
import { buttonVariants } from '@/components/ui/button';

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('loan:read:all');
  const { id } = await params;
  const cookieStore = await cookies();
  const loan = await endpoints.loanDetail(id, { cookieHeader: cookieStore.toString(), serverBase: process.env.API_URL_INTERNAL });
  const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN');

  return (
    <div className="space-y-6">
      <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="/admin/loans"><ArrowLeft size={16} />Back to loans</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{loan.loanRef}</h1>
        <StatusBadge status={loan.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Borrower</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{borrower?.fullName ?? '—'}</p>
            <p className="text-muted-foreground">{borrower?.email ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Product</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{loan.productName ?? '—'}</p>
            <p className="text-muted-foreground">{loan.productCode ?? '—'} · {loan.interestRate}% p.a.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Principal: {formatRupees(loan.principal)}</p>
            <p>Total repayment: {formatRupees(loan.totalRepayment)}</p>
            <p>Outstanding: {formatRupees(loan.outstanding)}</p>
            <p>Tenure: {loan.tenureDays} days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loan.payments.length === 0 ? (
            <p className="text-muted-foreground">No payments recorded.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>UTR</TableHead><TableHead>Amount</TableHead><TableHead>Paid at</TableHead></TableRow></TableHeader>
              <TableBody>
                {loan.payments.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.utr}</TableCell>
                    <TableCell>{formatRupees(p.amount)}</TableCell>
                    <TableCell>{fmtDate(p.paidAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
        <CardContent><LoanTimeline status={loan.status} entries={loan.timeline} /></CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Run the timeline test + build to verify the page type-checks**

Run: `bun run test src/components/common/__tests__/loan-timeline.test.tsx`
Expected: PASS.

Run: `bun run build`
Expected: build succeeds (the `[id]` dynamic route compiles).

- [ ] **Step 7: Commit**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add src/components/common/loan-timeline.tsx src/app/\(dashboard\)/admin/loans/\[id\]/page.tsx src/components/common/__tests__/loan-timeline.test.tsx
git commit -m "feat(dashboard): loan detail page + audit-trail timeline"
```

---

### Task 8: Full suite green + final wiring check

**Files:** none (verification task)

**Interfaces:** —

- [ ] **Step 1: Run the whole frontend test suite**

Run:
```bash
export PATH="/Users/gyankumar/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/gyankumar/Personal/LMS/lms-frontend
bun run test
```
Expected: all suites pass (existing v1/v2 suites + the new Task 1–7 suites). If any existing suite broke (e.g. a `loans()`-caller it exercised), fix the caller — do not weaken the test.

- [ ] **Step 2: Production build**

Run: `bun run build`
Expected: build succeeds with the new routes `/admin/overview`, `/admin/loans`, `/admin/loans/[id]` listed.

- [ ] **Step 3: Commit any fixups**

```bash
cd /Users/gyankumar/Personal/LMS/lms-frontend
git add -A
git commit -m "test: green full suite + build for v3 admin dashboard frontend" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage (B4):**
- Recharts setup + theme colors → Task 1 ✓
- `adminMetrics()`, `loans(filters)`, `loanDetail(id)` endpoints + types → Task 2 ✓
- KPI cards → Task 3 ✓; funnel/donut/timeseries/product bars + per-product table → Task 4 ✓
- Overview page gated `metrics:read`, sidebar first → Task 5 ✓
- Loans list page gated `loan:read:all`, filter bar, extended columns (Product, Outstanding, Disbursed), pagination, row→detail, Loans sidebar entry → Task 6 ✓
- Loan detail page + audit timeline via extended `LoanTimeline` → Task 7 ✓
- Full suite + build → Task 8 ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every test step shows the full test body and the exact `bun run test <path>` command.

**Type/signature consistency:** `AdminMetrics`, `LoanDetail`, `TimelineEntry`, `LoanFilters` defined in Task 2 and consumed unchanged in Tasks 3–7. `endpoints.loans(filters, o)` signature changed once (Task 2) and all three existing callers updated in the same task. `LoanTimeline` gains an optional `entries` prop (back-compat preserved; borrower `my-loans` still calls it with only `status`). `LoansTable` gains optional `linkBase` + columns that degrade to `—` for legacy/ops loans. Money: backend metrics/`byProduct` money is **rupees** → `formatRupeesAmount`; loan `principal`/`outstanding`/`payment.amount` remain **paise** → `formatRupees`. This split is called out in Global Constraints and applied consistently (KPI/breakdown use `formatRupeesAmount`; LoansTable/detail use `formatRupees`).

**Open dependency on Part A:** `endpoints.products()` and the `LoanProduct` type (used by the filter bar's product Select and the loans page) come from Part A, which is built first — noted in Task 6 with a fallback and a return-type check.
