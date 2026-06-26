'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { opsHome } from '@/lib/auth/ops-home';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Required') });

type FormValues = { email: string; password: string };

export function AuthForm({ mode }: { mode?: 'login' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Login returns the session (role + permissions) — route by role directly, no second request.
      const me = await endpoints.login(values);
      const next = params.get('next');
      const dest = next ?? (me.role.code !== 'BORROWER' ? opsHome(me.permissions) : '/');
      router.push(dest);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle>Log in</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{String(errors.email.message)}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-sm text-destructive">{String(errors.password.message)}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Log in
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          No account? <Link className="underline" href={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}>Create an account</Link>
        </p>
      </CardContent>
    </Card>
  );
}
