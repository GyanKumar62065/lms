'use client';
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupees } from '@/lib/money';
import type { Loan } from '@/types/api';

export function RecordCollectionDialog({ loan, trigger }: { loan: Loan; trigger: ReactElement }) {
  const router = useRouter();
  const [utr, setUtr] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const maxRupees = loan.outstanding / 100;

  const submit = async () => {
    setBusy(true);
    try {
      await endpoints.recordPayment(loan._id, { utr: utr.trim(), amount: Number(amount), paidAt: date });
      toast.success('Collection recorded'); router.refresh();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not record'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader><DialogTitle>Record collection — outstanding {formatRupees(loan.outstanding)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="utr">UTR</Label><Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="amount">Amount (₹, ≤ {maxRupees})</Label><Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="date">Date of collection</Label><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
          <Button disabled={busy || !utr.trim() || !amount || Number(amount) <= 0 || Number(amount) > maxRupees || !date} onClick={submit}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
