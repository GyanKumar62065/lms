'use client';
import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import type { PublicConfig, LoanProduct } from '@/types/api';

export function EstimateWidget({ config, products }: { config: PublicConfig; products?: LoanProduct[] }) {
  const hasProducts = Boolean(products && products.length);
  const [code, setCode] = useState(products?.[0]?.code ?? '');
  const selected = useMemo(() => products?.find((p) => p.code === code), [products, code]);

  const bounds = selected
    ? { min: selected.minPrincipal, max: selected.maxPrincipal, minT: selected.minTenureDays, maxT: selected.maxTenureDays, rate: selected.interestRate }
    : { min: config.loan.minPrincipal, max: config.loan.maxPrincipal, minT: config.loan.minTenureDays, maxT: config.loan.maxTenureDays, rate: config.loan.interestRate };

  const [amt, setAmt] = useState(bounds.min);
  const [ten, setTen] = useState(bounds.minT);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));
  const clampedAmt = Math.min(Math.max(amt, bounds.min), bounds.max);
  const clampedTen = Math.min(Math.max(ten, bounds.minT), bounds.maxT);
  const c = calcRepayment(clampedAmt, clampedTen, bounds.rate);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {hasProducts && (
          <Select value={code} onValueChange={(v) => setCode(String(v))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose a product" /></SelectTrigger>
            <SelectContent>
              {products!.map((p) => <SelectItem key={p.code} value={p.code}>{p.name} — {p.interestRate}%</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Amount</span><span>{formatRupees(clampedAmt * 100)}</span></div>
          <Slider min={bounds.min} max={bounds.max} step={1000} value={[clampedAmt]} onValueChange={(v) => setAmt(num(v))} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Tenure</span><span>{clampedTen} days</span></div>
          <Slider min={bounds.minT} max={bounds.maxT} step={1} value={[clampedTen]} onValueChange={(v) => setTen(num(v))} />
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm">Total repayment ({bounds.rate}% p.a.)</span>
          <span data-testid="estimate-total" className="text-xl font-semibold">{formatRupees(c.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
