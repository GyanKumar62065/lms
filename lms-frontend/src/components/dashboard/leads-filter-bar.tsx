'use client';
import { useRouter } from 'next/navigation';

const STAGES = ['', 'REGISTERED', 'DETAILS_SUBMITTED', 'BRE_REJECTED', 'SLIP_UPLOADED', 'APPLIED'] as const;

export function LeadsFilterBar({ current }: { current: { stage?: string } }) {
  const router = useRouter();
  return (
    <label className="text-sm flex items-center gap-2">
      <span>Stage</span>
      <select
        aria-label="Stage"
        className="rounded border bg-background px-2 py-1"
        defaultValue={current.stage ?? ''}
        onChange={(e) => router.push(e.target.value ? `/sales?stage=${e.target.value}` : '/sales')}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s === '' ? 'All' : s}
          </option>
        ))}
      </select>
    </label>
  );
}
