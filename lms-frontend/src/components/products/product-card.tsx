'use client';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

export function ProductCard({ product }: { product: LoanProduct }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Landmark size={18} />{product.name}</CardTitle>
        <p className="text-muted-foreground text-sm">{product.description}</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-1 text-sm">
        <div className="font-medium text-primary">{product.interestRate}% p.a.</div>
        <div className="text-muted-foreground">
          {formatRupees(product.minPrincipal * 100)} – {formatRupees(product.maxPrincipal * 100)}
        </div>
        <div className="text-muted-foreground">{product.minTenureDays}–{product.maxTenureDays} days</div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Link href={`/products/${product.code}`} className={buttonVariants({ variant: 'outline', className: 'flex-1' })}>
          View details
        </Link>
        <Link href={`/apply?product=${product.code}`} className={buttonVariants({ className: 'flex-1' })}>
          Apply
        </Link>
      </CardFooter>
    </Card>
  );
}
