import { Badge } from '@/components/ui/badge';
import { LoanStatus } from '@/types/api';
const VARIANT: Record<LoanStatus, string> = {
  APPLIED: 'bg-blue-100 text-blue-800',
  SANCTIONED: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  DISBURSED: 'bg-violet-100 text-violet-800',
  CLOSED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};
export function StatusBadge({ status }: { status: LoanStatus }) {
  return <Badge className={VARIANT[status]} variant="secondary">{status}</Badge>;
}
