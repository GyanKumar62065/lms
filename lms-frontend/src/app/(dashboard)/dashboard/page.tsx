import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { opsHome } from '@/lib/auth/ops-home';

export default async function DashboardIndex() {
  const me = await getSession();
  if (!me) redirect('/login?next=/dashboard');
  redirect(opsHome(me.permissions));
}
