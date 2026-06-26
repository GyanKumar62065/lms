import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { opsHome } from '@/lib/auth/ops-home';
import { TopBar } from '@/components/common/top-bar';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await getSession();
  if (!me) redirect('/login');
  if (me.role.code !== 'BORROWER') redirect(opsHome(me.permissions));
  return (
    <div className="min-h-screen">
      <TopBar name={me.fullName} />
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </div>
  );
}
