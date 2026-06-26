import { cookies } from 'next/headers';
import Link from 'next/link';
import { endpoints } from '@/lib/api/endpoints';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplyWizard } from '@/components/wizard/apply-wizard';

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: productCode } = await searchParams;
  const cookieHeader = (await cookies()).toString();
  const o = { cookieHeader, serverBase: process.env.API_URL_INTERNAL };

  let products: Awaited<ReturnType<typeof endpoints.publicProducts>>['data'] = [];
  try { products = (await endpoints.publicProducts(o)).data; } catch { /* empty */ }
  const initialProduct = productCode ? products.find((p) => p.code === productCode) : undefined;

  if (initialProduct) {
    try {
      const { data } = await endpoints.myLoans(o);
      const active = data.find((l) => ['APPLIED', 'SANCTIONED', 'DISBURSED'].includes(l.status) && l.productCode === initialProduct.code);
      if (active) {
        return (
          <Card className="mx-auto max-w-md">
            <CardHeader><CardTitle>Application in progress</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">You already have an active application for {initialProduct.name} ({active.loanRef}). You can apply again once it&apos;s closed or rejected.</p>
              <Link href="/my-loans" className={buttonVariants()}>View my loans</Link>
            </CardContent>
          </Card>
        );
      }
    } catch { /* fall through to wizard */ }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Apply for a loan</h1>
      <ApplyWizard products={products} initialProduct={initialProduct} />
    </div>
  );
}
