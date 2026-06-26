'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, CheckCircle2, Banknote, Wallet, ListChecks, Package, ShieldCheck,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin/overview', label: 'Overview', perm: 'metrics:read', Icon: LayoutDashboard },
  { href: '/sales', label: 'Sales', perm: 'lead:read', Icon: Users },
  { href: '/sanction', label: 'Sanction', perm: 'loan:sanction', Icon: CheckCircle2 },
  { href: '/disbursement', label: 'Disbursement', perm: 'loan:disburse', Icon: Banknote },
  { href: '/collection', label: 'Collection', perm: 'payment:create', Icon: Wallet },
  { href: '/admin/loans', label: 'Loans', perm: 'loan:read:all', Icon: ListChecks },
  { href: '/admin/products', label: 'Products', perm: 'product:manage', Icon: Package },
  { href: '/admin/roles', label: 'Roles', perm: 'rbac:read', Icon: ShieldCheck },
] as const;

const KEY = 'lms.sidebar.collapsed';

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem(KEY) === 'true'); }, []);
  const toggle = () => setCollapsed((c) => { const n = !c; localStorage.setItem(KEY, String(n)); return n; });
  const items = NAV.filter((n) => permissions.includes(n.perm));

  return (
    <aside className={cn('hidden md:flex flex-col border-r bg-card transition-[width] duration-200', collapsed ? 'w-16' : 'w-56')}>
      <div className={cn('flex items-center h-14 px-3 border-b', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && <span className="font-semibold tracking-tight">Operations</span>}
        <button
          type="button" onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {items.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href} href={href} title={collapsed ? label : undefined} aria-label={label}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                collapsed && 'justify-center px-0',
                active ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60',
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
