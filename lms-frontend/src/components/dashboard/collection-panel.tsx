'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Loan } from '@/types/api';
import { formatRupees } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/status-badge';

export function CollectionPanel({ loan }: { loan: Loan }) {
  const router = useRouter();
  const [utr, setUtr] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await endpoints.recordPayment(loan._id, { utr, amount: Number(amount), paidAt });
      toast.success(res.loan.status === 'CLOSED' ? 'Final payment — loan closed' : 'Payment recorded');
      setUtr(''); setAmount(''); setPaidAt('');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast.error('Duplicate UTR');
      else if (e instanceof ApiError && e.status === 422) toast.error(e.message);
      else toast.error('Could not record payment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="font-medium">{loan.loanRef}</p>
          <p className="text-sm text-muted-foreground">Outstanding: {formatRupees(loan.outstanding)} of {formatRupees(loan.totalRepayment)}</p>
        </div>
        <StatusBadge status={loan.status} />
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1"><Label>UTR</Label><Input value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
        <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="space-y-1"><Label>Date</Label><Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
        <div className="flex items-end">
          <Button className="w-full" disabled={busy || !utr || !amount || !paidAt} onClick={submit}>Record</Button>
        </div>
      </CardContent>
    </Card>
  );
}
