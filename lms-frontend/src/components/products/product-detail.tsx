'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import type { LoanProduct, Me } from '@/types/api';

export function ProductDetail({ product, me }: { product: LoanProduct; me: Me | null }) {
  const router = useRouter();
  const [amt, setAmt] = useState(product.minPrincipal);
  const [ten, setTen] = useState(product.minTenureDays);
  const c = calcRepayment(amt, ten, product.interestRate);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : v);
  function apply() {
    if (!me) return router.push(`/login?next=/apply?product=${product.code}`);
    if (me.role.code === 'BORROWER') return router.push(`/apply?product=${product.code}`);
    router.push('/');
  }
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {product.category && <p className="text-sm text-muted-foreground">{product.category}</p>}
        <p className="text-sm">{product.interestRate}% p.a.</p>
      </header>
      <p className="text-muted-foreground">{product.description}</p>
      <ul className="grid grid-cols-2 gap-2 text-sm">
        <li>Max amount: {formatRupees(product.maxPrincipal * 100)}</li>
        <li>Tenure: {product.minTenureDays}–{product.maxTenureDays} days</li>
        <li>Age: {product.eligibility.minAge}–{product.eligibility.maxAge}</li>
        <li>Min salary: {formatRupees(product.eligibility.minMonthlySalary * 100)}/mo</li>
        <li className="col-span-2">Employment: {product.eligibility.employmentModes.join(', ')}</li>
      </ul>
      <Card><CardContent className="space-y-4 pt-6">
        <div data-testid="amount-slider">
          <label className="text-sm">Amount: {formatRupees(amt * 100)}</label>
          <Slider value={[amt]} min={product.minPrincipal} max={product.maxPrincipal} step={1000} onValueChange={(v) => setAmt(num(v))} />
        </div>
        <div data-testid="tenure-slider">
          <label className="text-sm">Tenure: {ten} days</label>
          <Slider value={[ten]} min={product.minTenureDays} max={product.maxTenureDays} step={1} onValueChange={(v) => setTen(num(v))} />
        </div>
        <p>Interest: {formatRupees(c.interestPaise)}</p>
        <p data-testid="detail-total" className="text-lg font-semibold">Total repayment: {formatRupees(c.totalPaise)}</p>
      </CardContent></Card>
      <Button onClick={apply}>Apply for this loan</Button>
    </div>
  );
}
