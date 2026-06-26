'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { User, Mail, Phone, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { trackSignupStarted, trackSignupCompleted } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile'),
  password: z.string().min(8, 'Min 8 characters'),
  confirmPassword: z.string(),
  captchaText: z.string().min(1, 'Enter the captcha'),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type FormValues = z.infer<typeof schema>;

export function SignupForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [captcha, setCaptcha] = useState<{ captchaId: string; svg: string } | null>(null);

  const loadCaptcha = async () => {
    try {
      const data = await endpoints.getCaptcha();
      setCaptcha(data);
    } catch {
      // silently fail; user can retry
    }
  };

  useEffect(() => {
    trackSignupStarted();
    loadCaptcha();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    if (!captcha) return;
    try {
      await endpoints.signup({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        captchaId: captcha.captchaId,
        captchaText: values.captchaText,
      });
      trackSignupCompleted();
      router.push(next ?? '/');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422 && (e.code === 'CAPTCHA_INVALID' || (e.details as any)?.code === 'CAPTCHA_INVALID')) {
          toast.error('Invalid captcha. Please try again.');
          await loadCaptcha();
        } else if (e.status === 409) {
          toast.error('Email or phone already registered');
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error('Something went wrong');
      }
    }
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Create account</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* First name */}
          <div className="space-y-1">
            <Label htmlFor="firstName">First name</Label>
            <div className="relative flex items-center">
              <User className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="firstName" className="pl-9" {...register('firstName')} />
            </div>
            {errors.firstName && <p className="text-sm text-destructive">{String(errors.firstName.message)}</p>}
          </div>

          {/* Last name */}
          <div className="space-y-1">
            <Label htmlFor="lastName">Last name</Label>
            <div className="relative flex items-center">
              <User className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="lastName" className="pl-9" {...register('lastName')} />
            </div>
            {errors.lastName && <p className="text-sm text-destructive">{String(errors.lastName.message)}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="email" type="email" className="pl-9" {...register('email')} />
            </div>
            {errors.email && <p className="text-sm text-destructive">{String(errors.email.message)}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground select-none">
                <Phone className="h-4 w-4" />
                <span>+91</span>
              </div>
              <Input id="phone" type="tel" inputMode="numeric" maxLength={10} className="flex-1" {...register('phone')} />
            </div>
            {errors.phone && <p className="text-sm text-destructive">{String(errors.phone.message)}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="password" type="password" className="pl-9" {...register('password')} />
            </div>
            {errors.password && <p className="text-sm text-destructive">{String(errors.password.message)}</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="confirmPassword" type="password" className="pl-9" {...register('confirmPassword')} />
            </div>
            {errors.confirmPassword && <p className="text-sm text-destructive">{String(errors.confirmPassword.message)}</p>}
          </div>

          {/* Captcha */}
          <div className="space-y-1">
            <Label htmlFor="captchaText">Captcha</Label>
            <div className="flex items-center gap-2">
              {captcha && (
                <img
                  alt="captcha"
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
                  className="h-10 rounded border border-input bg-white"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={loadCaptcha}
                aria-label="Reload image"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative flex items-center">
              <ShieldCheck className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input id="captchaText" className="pl-9" {...register('captchaText')} />
            </div>
            {errors.captchaText && <p className="text-sm text-destructive">{String(errors.captchaText.message)}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account? <Link className="underline" href="/login">Log in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
