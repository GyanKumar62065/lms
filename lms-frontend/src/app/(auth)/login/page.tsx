import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
