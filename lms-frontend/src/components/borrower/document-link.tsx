'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';

export function DocumentLink({ loanId }: { loanId: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const d = await endpoints.borrowerDocument(loanId);
      window.open(d.url, '_blank');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Document unavailable');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={open}>
      View document
    </Button>
  );
}
