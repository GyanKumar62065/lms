'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Loan } from '@/types/api';
import { RecordCollectionDialog } from './record-collection-dialog';

export function LoanActionPanel({ loan, permissions }: { loan: Loan; permissions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const can = (p: string) => permissions.includes(p);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); router.refresh(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  };

  if (loan.status === 'APPLIED' && can('loan:sanction')) {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => run(() => endpoints.sanction(loan._id), 'Loan sanctioned')}>Approve</Button>
        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="destructive">Reject</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Reject loan</DialogTitle></DialogHeader>
            <Input placeholder="Reason (min 3 chars)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button variant="destructive" disabled={busy || reason.trim().length < 3}
                onClick={() => run(() => endpoints.reject(loan._id, reason.trim()), 'Loan rejected')}>Confirm reject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  if (loan.status === 'SANCTIONED' && can('loan:disburse')) {
    return <Button size="sm" disabled={busy} onClick={() => run(() => endpoints.disburse(loan._id), 'Loan disbursed')}>Disburse</Button>;
  }
  if (loan.status === 'DISBURSED' && can('payment:create')) {
    return <RecordCollectionDialog loan={loan} trigger={<Button size="sm">Record Collection</Button>} />;
  }
  return null;
}
