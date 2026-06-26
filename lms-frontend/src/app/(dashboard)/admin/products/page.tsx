import { cookies } from 'next/headers';
import { Package } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { endpoints } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { ProductsTable } from '@/components/dashboard/products-table';
import { ProductFormDialog } from '@/components/dashboard/product-form-dialog';

export default async function AdminProductsPage() {
  await requirePermission('product:manage');
  const cookieHeader = (await cookies()).toString();
  const { data } = await endpoints.products({ cookieHeader, serverBase: process.env.API_URL_INTERNAL });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Package size={20} />Loan products</h1>
        <ProductFormDialog trigger={<Button size="sm">New product</Button>} />
      </div>
      <ProductsTable products={data} />
    </div>
  );
}
