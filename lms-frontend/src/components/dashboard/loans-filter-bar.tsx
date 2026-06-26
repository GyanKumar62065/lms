'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoanFilters, LoanProduct } from '@/types/api';

const STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'];
const ALL = 'ALL';

export function LoansFilterBar({ current, products }: { current: LoanFilters; products: LoanProduct[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(current.status ?? ALL);
  const [productCode, setProductCode] = useState<string>(current.productCode ?? ALL);
  const [q, setQ] = useState(current.q ?? '');
  const [from, setFrom] = useState(current.from ?? '');
  const [to, setTo] = useState(current.to ?? '');
  const [minAmount, setMinAmount] = useState(current.minAmount?.toString() ?? '');
  const [maxAmount, setMaxAmount] = useState(current.maxAmount?.toString() ?? '');

  function apply() {
    const qs = new URLSearchParams();
    const set = (k: string, v: string) => { if (v && v !== ALL) qs.set(k, v); };
    set('status', status);
    set('productCode', productCode);
    if (q.trim()) qs.set('q', q.trim());
    set('from', from);
    set('to', to);
    if (minAmount) qs.set('minAmount', minAmount);
    if (maxAmount) qs.set('maxAmount', maxAmount);
    const s = qs.toString();
    router.push(s ? `/admin/loans?${s}` : '/admin/loans');
  }

  function clear() {
    router.push('/admin/loans');
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-3 lg:grid-cols-4">
      <div className="space-y-1">
        <Label>Search</Label>
        <Input placeholder="Search ref, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Product</Label>
        <Select value={productCode} onValueChange={(v) => setProductCode(v ?? ALL)}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Any product" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any product</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Min ₹</Label>
          <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Max ₹</Label>
          <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <Button onClick={apply}>Apply</Button>
        <Button variant="outline" onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
