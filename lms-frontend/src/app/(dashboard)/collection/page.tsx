import { cookies } from 'next/headers';
import { Wallet } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { LoansTable } from '@/components/dashboard/loans-table';
import { RecordCollectionDialog } from '@/components/dashboard/record-collection-dialog';
import { Button } from '@/components/ui/button';

export default async function CollectionPage() {
  await requirePermission('payment:create');
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const { data } = await endpoints.loans({ status: 'DISBURSED' }, { cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold"><Wallet size={20} />Collection — Active Loans</h1>
      <LoansTable
        loans={data}
        linkBase="/loans"
        renderActions={(loan) => (
          <RecordCollectionDialog loan={loan} trigger={<Button size="sm">Record</Button>} />
        )}
      />
    </div>
  );
}
