'use client';
import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import type { LoanDocument } from '@/types/api';

export function DocumentPanel({ loanId }: { loanId: string }) {
  const [doc, setDoc] = useState<LoanDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setDoc(await endpoints.loanDocument(loanId)); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not load document'); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-muted-foreground" />
        <Button size="sm" variant="outline" onClick={load} disabled={busy}>View document</Button>
        {doc && (
          <a href={doc.url} download={doc.filename} className="inline-flex items-center gap-1 text-sm underline">
            <Download size={14} /> Download
          </a>
        )}
      </div>
      {doc && (doc.mime.startsWith('image/')
        ? <img src={doc.url} alt={doc.filename} className="max-h-96 rounded border" />
        : <iframe title="Document preview" src={doc.url} className="h-96 w-full rounded border" />)}
    </div>
  );
}
