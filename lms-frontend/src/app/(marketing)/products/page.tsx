import { cookies } from 'next/headers';
import { endpoints } from '@/lib/api/endpoints';
import { ProductCard } from '@/components/products/product-card';

export default async function ProductsPage() {
  const cookieHeader = (await cookies()).toString();
  let products = [] as Awaited<ReturnType<typeof endpoints.publicProducts>>['data'];
  try {
    products = (await endpoints.publicProducts({ cookieHeader, serverBase: process.env.API_URL_INTERNAL })).data;
  } catch { /* render empty state */ }
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Loan products</h1>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products are available right now. Please check back soon.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <ProductCard key={p.code} product={p} />)}
        </div>
      )}
    </div>
  );
}
