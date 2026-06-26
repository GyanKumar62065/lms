'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { calcRepayment } from '@/lib/loan-calc';
import { formatRupees } from '@/lib/money';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import type { LoanProduct } from '@/types/api';

export function StepConfig({ product, onApplied }: { product: LoanProduct; onApplied: () => void }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState(product.minPrincipal);
  const [tenure, setTenure] = useState(product.minTenureDays);
  const [busy, setBusy] = useState(false);
  const calc = calcRepayment(principal, tenure, product.interestRate);
  const num = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

  const apply = async () => {
    setBusy(true);
    try {
      await endpoints.apply({ productCode: product.code, principal, tenureDays: tenure });
      toast.success('Application submitted');
      onApplied();
      router.push('/my-loans');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not apply');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Amount</span><span>{formatRupees(principal * 100)}</span></div>
          <Slider min={product.minPrincipal} max={product.maxPrincipal} step={1000} value={[principal]} onValueChange={(v) => setPrincipal(num(v))} />
        </div>
        <div>
          <div className="mb-2 flex justify-between text-sm"><span>Tenure</span><span>{tenure} days</span></div>
          <Slider min={product.minTenureDays} max={product.maxTenureDays} step={1} value={[tenure]} onValueChange={(v) => setTenure(num(v))} />
        </div>
      </div>
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <Row label="Principal" value={formatRupees(calc.principalPaise)} testId="principal" />
          <Row label={`Interest (${product.interestRate}% p.a.)`} value={formatRupees(calc.interestPaise)} testId="interest" />
          <div className="border-t pt-2">
            <Row label="Total Repayment" value={formatRupees(calc.totalPaise)} testId="total-repayment" bold />
          </div>
          <Button className="mt-3 w-full" onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply Now'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, testId, bold }: { label: string; value: string; testId: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span data-testid={testId} className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}
