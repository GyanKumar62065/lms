const ORDER: { perm: string; href: string }[] = [
  { perm: 'metrics:read', href: '/admin/overview' },
  { perm: 'lead:read', href: '/sales' },
  { perm: 'loan:sanction', href: '/sanction' },
  { perm: 'loan:disburse', href: '/disbursement' },
  { perm: 'payment:create', href: '/collection' },
  { perm: 'loan:read:all', href: '/admin/loans' },
  { perm: 'product:manage', href: '/admin/products' },
  { perm: 'rbac:read', href: '/admin/roles' },
];
export function opsHome(permissions: string[]): string {
  const hit = ORDER.find((o) => permissions.includes(o.perm));
  return hit ? hit.href : '/sanction';
}

export function isOpsUser(me: { role: { code: string } }): boolean {
  return me.role.code !== 'BORROWER';
}
