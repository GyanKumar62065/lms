'use client';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import type { LoanProduct } from '@/types/api';
import { formatRupees } from '@/lib/money';

export function ProductCarousel({ products }: { products: LoanProduct[] }) {
  const items = products.slice(0, 5);
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Available loans</h2>
        <Link href="/products" className="text-sm underline">See more loans</Link>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link key={p.code} href={`/products/${p.code}`} data-testid="carousel-tile"
            className="min-w-[240px] snap-start rounded-lg border p-4 hover:bg-accent">
            <Landmark className="mb-2 h-5 w-5 text-primary" />
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.interestRate}% p.a.</div>
            <div className="text-sm">{formatRupees(p.minPrincipal * 100)}–{formatRupees(p.maxPrincipal * 100)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
