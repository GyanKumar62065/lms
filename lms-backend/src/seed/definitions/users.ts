export const SEED_USERS = [
  { fullName: 'Admin User', email: 'admin@lms.test', password: 'Admin@123', roleCode: 'ADMIN' },
  { fullName: 'Sales Exec', email: 'sales@lms.test', password: 'Sales@123', roleCode: 'SALES' },
  { fullName: 'Sanction Exec', email: 'sanction@lms.test', password: 'Sanction@123', roleCode: 'SANCTION' },
  { fullName: 'Disbursement Exec', email: 'disbursement@lms.test', password: 'Disburse@123', roleCode: 'DISBURSEMENT' },
  { fullName: 'Collection Exec', email: 'collection@lms.test', password: 'Collect@123', roleCode: 'COLLECTION' },
  { fullName: 'Demo Borrower', email: 'borrower@lms.test', password: 'Borrow@123', roleCode: 'BORROWER' },
] as const;
