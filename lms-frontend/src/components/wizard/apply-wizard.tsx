'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Stepper } from './stepper';
import { StepDetails } from './step-details';
import { StepSlip } from './step-slip';
import { StepConfig } from './step-config';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

const STEPS = ['Product', 'Details', 'Salary Slip', 'Loan & Apply'];

export function ApplyWizard({ products, initialProduct }: { products: LoanProduct[]; initialProduct?: LoanProduct }) {
  const [product, setProduct] = useState<LoanProduct | undefined>(initialProduct);
  const [step, setStep] = useState(1);

  if (!product) {
    return (
      <div className="space-y-4">
        <h2 className="font-medium">Choose a loan product</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <Card key={p.code}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/apply?product=${p.code}`} className="hover:underline">{p.name}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-primary font-medium">{p.interestRate}% p.a.</div>
                <div className="text-muted-foreground">{formatRupees(p.minPrincipal * 100)} – {formatRupees(p.maxPrincipal * 100)}</div>
                <div className="flex gap-2 pt-1">
                  <button className={buttonVariants({ size: 'sm' })} onClick={() => setProduct(p)}>Select</button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Stepper steps={STEPS} current={step + 1} />
      {step === 1 && <StepDetails onPassed={() => setStep(2)} />}
      {step === 2 && <StepSlip onStaged={() => setStep(3)} />}
      {step === 3 && <StepConfig product={product} onApplied={() => {}} />}
    </div>
  );
}
