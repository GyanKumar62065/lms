import { formatRupees } from '@/lib/money';
export function MoneyText({ paise }: { paise: number }) {
  return <span>{formatRupees(paise)}</span>;
}
