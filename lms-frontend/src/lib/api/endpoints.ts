import { apiFetch } from './client';
import { Loan, Me, Paginated, Payment, Lead, RoleView, PublicConfig, LoanProduct, AdminMetrics, LoanDetail, LoanFilters, BorrowerLoanDetail, DocumentRef, LoanDocument } from '@/types/api';

type Opts = { cookieHeader?: string; serverBase?: string };
const post = (path: string, body?: unknown, o?: Opts) =>
  apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, o);
const put = (path: string, body: unknown, o?: Opts) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }, o);
const get = <T>(path: string, o?: Opts) => apiFetch<T>(path, { method: 'GET' }, o);

export const endpoints = {
  signup: (b: { firstName: string; lastName: string; email: string; phone: string; password: string; captchaId: string; captchaText: string }) => post('/auth/signup', b),
  getCaptcha: (o?: Opts) => get<{ captchaId: string; svg: string }>('/auth/captcha', o),
  publicConfig: (o?: Opts) => get<PublicConfig>('/public/config', o),
  track: (events: { name: string; path?: string; referrer?: string; utm?: any; ts?: string }[]) =>
    apiFetch('/track', { method: 'POST', body: JSON.stringify({ events }) }).catch(() => undefined),
  // Login returns the session (role + permissions) so the form can route by role without a second request.
  login: (b: { email: string; password: string }) => post('/auth/login', b) as Promise<Me>,
  logout: () => post('/auth/logout'),
  me: (o?: Opts) => get<Me>('/auth/me', o),

  putProfile: (b: unknown) => put('/borrower/profile', b),
  presignSlip: (b: { filename: string; mime: string; size: number }) =>
    post('/borrower/salary-slip/presign', b) as Promise<{ uploadUrl: string; objectKey: string }>,
  stageSlip: (b: unknown) => put('/borrower/salary-slip', b),
  apply: (b: { productCode: string; principal: number; tenureDays: number }) => post('/borrower/loans', b) as Promise<Loan>,
  myLoans: (o?: Opts) => get<Paginated<Loan>>('/borrower/loans', o),
  cancelLoan: (id: string, body?: { reason?: string }, opts?: Opts) =>
    post(`/borrower/loans/${id}/cancel`, body ?? {}, opts),
  myLoanDetail: (id: string, opts?: Opts) =>
    get<BorrowerLoanDetail>(`/borrower/loans/${id}`, opts),
  borrowerDocument: (id: string, opts?: Opts) =>
    get<DocumentRef>(`/borrower/loans/${id}/document`, opts),

  leads: (filters: { stage?: string } = {}, opts?: Opts) => {
    const qs = new URLSearchParams();
    if (filters.stage) qs.set('stage', filters.stage);
    const s = qs.toString();
    return get<Paginated<Lead>>(`/leads${s ? `?${s}` : ''}`, opts);
  },
  markContacted: (userId: string, note?: string) => apiFetch(`/leads/${userId}/contacted`, { method: 'PATCH', body: JSON.stringify({ note }) }),

  loans: (filters: LoanFilters = {}, o?: Opts) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return get<Paginated<Loan>>(`/loans${q ? `?${q}` : ''}`, o);
  },
  loanDetail: (id: string, o?: Opts) => get<LoanDetail>(`/loans/${id}`, o),
  loanDocument: (id: string, opts?: Opts) => get<LoanDocument>(`/loans/${id}/document`, opts),
  adminMetrics: (o?: Opts) => get<AdminMetrics>('/admin/metrics', o),
  sanction: (id: string) => post(`/loans/${id}/sanction`) as Promise<Loan>,
  reject: (id: string, reason: string) => post(`/loans/${id}/reject`, { reason }) as Promise<Loan>,
  disburse: (id: string) => post(`/loans/${id}/disburse`) as Promise<Loan>,

  payments: (id: string, o?: Opts) => get<{ data: Payment[]; outstanding: number; totalRepayment: number }>(`/loans/${id}/payments`, o),
  recordPayment: (id: string, b: { utr: string; amount: number; paidAt: string }) =>
    post(`/loans/${id}/payments`, b) as Promise<{ loan: Loan; payment: Payment }>,

  roles: (o?: Opts) => get<{ data: RoleView[] }>('/admin/roles', o),

  publicProducts: (o?: Opts) => get<{ data: LoanProduct[] }>('/public/products', o),
  products: (o?: Opts) => get<{ data: LoanProduct[] }>('/products', o),
  product: (code: string, o?: Opts) => get<LoanProduct>(`/products/${code}`, o),
  createProduct: (b: unknown) => post('/admin/products', b) as Promise<LoanProduct>,
  updateProduct: (id: string, b: unknown) => apiFetch(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(b) }) as Promise<LoanProduct>,
  activateProduct: (id: string) => post(`/admin/products/${id}/activate`) as Promise<LoanProduct>,
  deactivateProduct: (id: string) => post(`/admin/products/${id}/deactivate`) as Promise<LoanProduct>,
};
