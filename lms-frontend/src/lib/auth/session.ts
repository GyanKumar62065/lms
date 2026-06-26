import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { Me } from '@/types/api';

export function hasPermission(me: Me, perm: string): boolean {
  return me.permissions.includes(perm);
}

export async function getSession(): Promise<Me | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;
  try {
    return await endpoints.me({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  } catch {
    return null;
  }
}

export async function requirePermission(perm: string): Promise<Me> {
  const me = await getSession();
  if (!me) redirect('/login');
  if (!hasPermission(me, perm)) redirect('/forbidden');
  return me;
}
