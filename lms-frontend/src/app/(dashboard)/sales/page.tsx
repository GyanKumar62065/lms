import { cookies } from 'next/headers';
import { Users } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LeadsTable } from '@/components/dashboard/leads-table';
import { LeadsFilterBar } from '@/components/dashboard/leads-filter-bar';

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requirePermission('lead:read');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { stage } = await searchParams;
  const { data } = await endpoints.leads({ stage }, { cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><Users size={20} />Sales — Lead Tracking</h1>
      <LeadsFilterBar current={{ stage }} />
      <div className="overflow-x-auto">
        <LeadsTable leads={data} />
      </div>
    </div>
  );
}
