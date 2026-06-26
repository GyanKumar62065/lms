import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/signup-form';
export default function SignupPage() {
  return <main className="grid min-h-screen place-items-center p-6"><Suspense><SignupForm /></Suspense></main>;
}
