'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { endpoints } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';

const MAX = 5 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

export function StepSlip({ onStaged }: { onStaged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return toast.error('Only PDF, JPG, PNG allowed');
    if (file.size > MAX) return toast.error('Max 5 MB');
    setBusy(true);
    try {
      const { uploadUrl, objectKey } = await endpoints.presignSlip({ filename: file.name, mime: file.type, size: file.size });
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload failed');
      await endpoints.stageSlip({ objectKey, filename: file.name, mime: file.type, size: file.size });
      onStaged();
    } catch {
      toast.error('Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block cursor-pointer rounded-lg border border-dashed p-8 text-center">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Click to choose your salary slip (PDF/JPG/PNG, max 5 MB)'}
      </label>
      <Button onClick={upload} disabled={!file || busy}>{busy ? 'Uploading…' : 'Upload & Continue'}</Button>
    </div>
  );
}
