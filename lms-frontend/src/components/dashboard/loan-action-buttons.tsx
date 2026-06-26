'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoanActionButtons({ loanId, mode }: { loanId: string; mode: 'sanction' | 'disburse' }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      toast.success('Done');
      router.refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'disburse') {
    return (
      <Button size="sm" disabled={busy} onClick={() => run(() => endpoints.disburse(loanId))}>
        Disburse
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={() => run(() => endpoints.sanction(loanId))}>
        Approve
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" variant="destructive" />}>
          Reject
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Insufficient income proof"
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                const ok = await run(() => endpoints.reject(loanId, reason));
                if (ok) setOpen(false);
              }}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
