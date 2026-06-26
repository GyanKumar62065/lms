export type Paginated<T> = { data: T[]; pagination: { page: number; limit: number; total: number } };
export type Me = {
  id: string;
  fullName: string;
  email: string;
  role: { code: string; name: string };
  permissions: string[];
};
export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED' | 'CANCELLED';
export type Loan = {
  _id: string;
  loanRef: string;
  borrower: string | { _id: string; fullName: string; email: string };
  principal: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;
  outstanding: number;
  status: LoanStatus;
  productCode?: string;
  productName?: string;
  disbursement?: { at?: string };
  sanction?: { reason?: string; decidedAt?: string };
  statusHistory: { from: string | null; to: string; reason?: string; at: string }[];
  createdAt: string;
};
export type Payment = { _id: string; utr: string; amount: number; paidAt: string };
export type Lead = {
  userId: string;
  fullName: string;
  email: string;
  registeredAt: string;
  stage: 'REGISTERED' | 'DETAILS_SUBMITTED' | 'BRE_REJECTED' | 'SLIP_UPLOADED';
  eligibility: { passed: boolean; failedRules: string[] } | null;
  monthlySalary: number | null;
  employmentMode: string | null;
  contacted: { flag: boolean; note?: string } | null;
};
export type RoleView = { code: string; name: string; description: string; isSystem: boolean; permissions: string[] };
export type PublicConfig = {
  loan: { minPrincipal: number; maxPrincipal: number; interestRate: number; minTenureDays: number; maxTenureDays: number };
  eligibility: { minAge: number; maxAge: number; minMonthlySalary: number; employmentModes: string[] };
};
export type ProductEligibility = {
  minAge: number;
  maxAge: number;
  minMonthlySalary: number;
  employmentModes: string[];
};
export type LoanProduct = {
  _id: string;
  code: string;
  name: string;
  description: string;
  category?: string;
  interestRate: number;
  minPrincipal: number;
  maxPrincipal: number;
  minTenureDays: number;
  maxTenureDays: number;
  eligibility: ProductEligibility;
  status: 'ACTIVE' | 'INACTIVE';
};

export type AdminMetrics = {
  kpis: {
    totalDisbursed: number;
    totalRecovered: number;
    outstandingBook: number;
    activeLoans: number;
    totalApplications: number;
    approvalRate: number;     // 0..100 (percent, 1 decimal)
    rejectedCount: number;
    rejectionRate: number;    // 0..100 (percent, 1 decimal)
    avgTicketSize: number;
  };
  byStatus: { status: LoanStatus; count: number }[];
  funnel: { applied: number; sanctioned: number; disbursed: number; closed: number; rejected: number };
  timeSeries: { month: string; disbursed: number; recovered: number }[];
  byProduct: {
    productCode: string;
    productName: string;
    applicants: number;
    borrowed: number;
    recovered: number;
    outstanding: number;
    active: number;
    rejected: number;
    approvalRate: number;     // 0..100 (percent, 1 decimal)
  }[];
};

export type TimelineEntry = {
  type: 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED' | 'PAYMENT' | 'CANCELLED';
  at: string;
  actor: { id: string; name: string } | null;
  detail?: string;
};

export type LoanDetail = {
  loan: Loan;
  payments: Payment[];
  timeline: TimelineEntry[];
};

export type DocumentRef = { url: string; filename: string; mime: string };
export type LoanDocument = { url: string; filename: string; mime: string };
export type BorrowerLoanDetail = { loan: Loan; payments: Payment[] };

export type LoanFilters = {
  status?: string;
  productCode?: string;
  from?: string;
  to?: string;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  page?: number;
  limit?: number;
};
