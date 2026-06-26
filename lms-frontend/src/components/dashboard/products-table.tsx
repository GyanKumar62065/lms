'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductFormDialog } from './product-form-dialog';
import { formatRupees } from '@/lib/money';
import type { LoanProduct } from '@/types/api';

export function ProductsTable({ products }: { products: LoanProduct[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (p: LoanProduct) => {
    setBusy(p._id);
    try {
      if (p.status === 'ACTIVE') await endpoints.deactivateProduct(p._id);
      else await endpoints.activateProduct(p._id);
      toast.success('Updated');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Rate</TableHead>
          <TableHead>Principal</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow key={p._id}>
            <TableCell className="font-mono text-xs">{p.code}</TableCell>
            <TableCell>{p.name}</TableCell>
            <TableCell>{p.interestRate}%</TableCell>
            <TableCell>{formatRupees(p.minPrincipal * 100)}–{formatRupees(p.maxPrincipal * 100)}</TableCell>
            <TableCell><Badge variant={p.status === 'ACTIVE' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
            <TableCell className="flex gap-2">
              <ProductFormDialog product={p} trigger={<Button size="sm" variant="outline">Edit</Button>} />
              <Button size="sm" variant={p.status === 'ACTIVE' ? 'destructive' : 'default'} disabled={busy === p._id} onClick={() => toggle(p)}>
                {p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
