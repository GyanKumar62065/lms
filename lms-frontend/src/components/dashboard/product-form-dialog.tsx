'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LoanProduct } from '@/types/api';

const schema = z.object({
  code: z.string().min(1, 'Required').transform((s) => s.toUpperCase()),
  name: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  interestRate: z.coerce.number().min(0),
  minPrincipal: z.coerce.number().positive(),
  maxPrincipal: z.coerce.number().positive(),
  minTenureDays: z.coerce.number().int().positive(),
  maxTenureDays: z.coerce.number().int().positive(),
  minAge: z.coerce.number().int().positive(),
  maxAge: z.coerce.number().int().positive(),
  minMonthlySalary: z.coerce.number().positive(),
  employmentModes: z.string().min(1).default('Salaried,Self-Employed'),
  category: z.string().optional(),
}).refine((v) => v.maxPrincipal >= v.minPrincipal, { path: ['maxPrincipal'], message: 'Max must be ≥ min' })
  .refine((v) => v.maxTenureDays >= v.minTenureDays, { path: ['maxTenureDays'], message: 'Max must be ≥ min' })
  .refine((v) => v.maxAge >= v.minAge, { path: ['maxAge'], message: 'Max must be ≥ min' });

type FormValues = z.input<typeof schema>;

export function ProductFormDialog({ product, trigger }: { product?: LoanProduct; trigger: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const editing = Boolean(product);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product ? {
      code: product.code, name: product.name, description: product.description, interestRate: product.interestRate,
      minPrincipal: product.minPrincipal, maxPrincipal: product.maxPrincipal, minTenureDays: product.minTenureDays,
      maxTenureDays: product.maxTenureDays, minAge: product.eligibility.minAge, maxAge: product.eligibility.maxAge,
      minMonthlySalary: product.eligibility.minMonthlySalary, employmentModes: product.eligibility.employmentModes.join(','),
      category: product.category ?? '',
    } : {
      employmentModes: 'Salaried,Self-Employed',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    const body: Record<string, unknown> = {
      code: v.code, name: v.name, description: v.description, interestRate: Number(v.interestRate),
      minPrincipal: Number(v.minPrincipal), maxPrincipal: Number(v.maxPrincipal),
      minTenureDays: Number(v.minTenureDays), maxTenureDays: Number(v.maxTenureDays),
      eligibility: {
        minAge: Number(v.minAge), maxAge: Number(v.maxAge), minMonthlySalary: Number(v.minMonthlySalary),
        employmentModes: String(v.employmentModes).split(',').map((s) => s.trim()).filter(Boolean),
      },
    };
    if (v.category && v.category.trim()) body.category = v.category.trim();
    try {
      if (editing && product) await endpoints.updateProduct(product._id, body);
      else await endpoints.createProduct(body);
      toast.success(editing ? 'Product updated' : 'Product created');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save product');
    }
  });

  const F = ({ id, label, type = 'text', disabled }: { id: keyof FormValues; label: string; type?: string; disabled?: boolean }) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} disabled={disabled} {...register(id)} />
      {errors[id] && <p className="text-sm text-destructive">{String(errors[id]?.message)}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <F id="code" label="Code" disabled={editing} />
          <F id="name" label="Name" />
          <div className="col-span-2"><F id="description" label="Description" /></div>
          <F id="interestRate" label="Interest rate (% p.a.)" type="number" />
          <F id="minMonthlySalary" label="Min monthly salary (₹)" type="number" />
          <F id="minPrincipal" label="Min principal (₹)" type="number" />
          <F id="maxPrincipal" label="Max principal (₹)" type="number" />
          <F id="minTenureDays" label="Min tenure (days)" type="number" />
          <F id="maxTenureDays" label="Max tenure (days)" type="number" />
          <F id="minAge" label="Min age" type="number" />
          <F id="maxAge" label="Max age" type="number" />
          <div className="col-span-2"><F id="employmentModes" label="Employment modes (comma-separated)" /></div>
          <div className="col-span-2"><F id="category" label="Category (optional)" /></div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isSubmitting}>Save product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
