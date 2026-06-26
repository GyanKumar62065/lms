'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';

export function TopBar({ name }: { name: string }) {
  const router = useRouter();
  const logout = async () => {
    await endpoints.logout();
    router.push('/');
    router.refresh();
  };
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="font-semibold">LMS</Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{name}</span>
        <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
      </div>
    </header>
  );
}
