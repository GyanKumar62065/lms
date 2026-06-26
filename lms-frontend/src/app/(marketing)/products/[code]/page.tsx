import { notFound } from 'next/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { getSession } from '@/lib/auth/session';
import { ProductDetail } from '@/components/products/product-detail';

export default async function ProductDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await getSession();
  // Public detail page: read the public (active-only) catalog and match by code —
  // the authed GET /products/:code (product:read) would 401 for anonymous visitors.
  const res = await endpoints.publicProducts({ serverBase: process.env.API_URL_INTERNAL }).catch(() => null);
  const product = res?.data.find((p) => p.code === code);
  if (!product) notFound();
  return <div className="mx-auto max-w-3xl px-4 py-10"><ProductDetail product={product} me={me} /></div>;
}
