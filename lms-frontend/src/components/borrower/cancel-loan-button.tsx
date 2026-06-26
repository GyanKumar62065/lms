'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import type { LoanStatus } from '@/types/api';

const CANCELLABLE: LoanStatus[] = ['APPLIED', 'SANCTIONED'];

export function CancelLoanButton({ loanId, status }: { loanId: string; status: LoanStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!CANCELLABLE.includes(status)) return null;
  async function onConfirm() {
    setBusy(true);
    try {
      await endpoints.cancelLoan(loanId);
      toast.success('Loan cancelled');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm">Cancel loan</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this loan?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">This stops the application. You can re-apply later.</p>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Keep loan</Button>} />
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>Confirm cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
