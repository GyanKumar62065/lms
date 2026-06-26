import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { isOpsUser } from '@/lib/auth/ops-home';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopBar } from '@/components/common/top-bar';

const EXEC_PERMS = ['lead:read', 'loan:sanction', 'loan:disburse', 'payment:create', 'rbac:read', 'loan:read:all'];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (!me) redirect('/login');
  if (!isOpsUser(me)) redirect('/'); // borrowers go to the borrower home
  if (!me.permissions.some((p) => EXEC_PERMS.includes(p))) redirect('/forbidden');
  return (
    <div className="min-h-screen">
      <TopBar name={me.fullName} />
      <div className="flex">
        <Sidebar permissions={me.permissions} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
