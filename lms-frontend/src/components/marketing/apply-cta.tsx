'use client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackApplyClicked } from '@/lib/analytics';
import type { Me } from '@/types/api';

export function ApplyCTA({ me, label = 'Apply now', variant }: { me: Me | null; label?: string; variant?: 'default' | 'secondary' | 'outline' }) {
  const router = useRouter();
  const onClick = () => {
    trackApplyClicked();
    if (!me) return router.push('/login?next=/apply');
    if (me.role.code === 'BORROWER') return router.push('/apply');
    toast.message("Staff accounts can't apply for loans");
    router.push('/dashboard');
  };
  return (
    <Button variant={variant} onClick={onClick}>
      {label} <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  );
}
