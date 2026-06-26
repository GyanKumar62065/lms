export const ROLES = [
  {
    code: 'ADMIN',
    name: 'Admin',
    description: 'Full operational access',
    permissions: ['lead:read', 'loan:read:all', 'loan:sanction', 'loan:disburse', 'payment:create', 'payment:read', 'rbac:read', 'product:read', 'product:manage', 'metrics:read', 'loan:cancel'],
  },
  { code: 'SALES', name: 'Sales', description: 'Lead tracking', permissions: ['lead:read', 'product:read'] },
  { code: 'SANCTION', name: 'Sanction', description: 'Approve/reject loans', permissions: ['loan:sanction', 'loan:read:all', 'payment:read', 'product:read'] },
  { code: 'DISBURSEMENT', name: 'Disbursement', description: 'Disburse funds', permissions: ['loan:disburse', 'loan:read:all', 'payment:read', 'product:read'] },
  { code: 'COLLECTION', name: 'Collection', description: 'Record payments', permissions: ['payment:create', 'payment:read', 'loan:read:all', 'product:read'] },
  { code: 'BORROWER', name: 'Borrower', description: 'Apply and track own loans', permissions: ['loan:apply', 'loan:read:own', 'loan:cancel'] },
] as const;
