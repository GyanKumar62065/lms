import { cookies } from 'next/headers';
import { ListChecks } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LoansTable } from '@/components/dashboard/loans-table';
import { LoansFilterBar } from '@/components/dashboard/loans-filter-bar';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { LoanFilters } from '@/types/api';

export default async function AdminLoansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('loan:read:all');
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const o = { cookieHeader, serverBase: process.env.API_URL_INTERNAL };

  const page = Number(sp.page ?? '1') || 1;
  const filters: LoanFilters = {
    status: sp.status,
    productCode: sp.productCode,
    q: sp.q,
    from: sp.from,
    to: sp.to,
    minAmount: sp.minAmount ? Number(sp.minAmount) : undefined,
    maxAmount: sp.maxAmount ? Number(sp.maxAmount) : undefined,
    sort: sp.sort ?? '-createdAt',
    page,
    limit: 20,
  };

  const [{ data, pagination }, productsRes] = await Promise.all([
    endpoints.loans(filters, o),
    endpoints.products(o).catch(() => ({ data: [] })),
  ]);
  const products = productsRes.data ?? [];

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const qsFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: String(p) })) {
      if (v) qs.set(k, String(v));
    }
    return `/admin/loans?${qs.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <ListChecks size={20} />All Loans
      </h1>
      <LoansFilterBar current={filters} products={products} />
      <div className="overflow-x-auto">
        <LoansTable loans={data} linkBase="/admin/loans" />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {pagination.page} of {totalPages} · {pagination.total} loans
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              href={qsFor(page - 1)}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              href={qsFor(page + 1)}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
