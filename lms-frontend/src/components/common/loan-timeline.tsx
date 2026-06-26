import { LoanStatus, TimelineEntry } from '@/types/api';
import { cn } from '@/lib/utils';

const FLOW: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED', 'CLOSED'];

function StatusFlow({ status }: { status: LoanStatus }) {
  if (status === 'REJECTED') {
    return <p className="text-sm font-medium text-red-700">APPLIED → REJECTED</p>;
  }
  if (status === 'CANCELLED') {
    return <p className="text-sm font-medium text-slate-500">APPLIED → CANCELLED</p>;
  }
  const idx = FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1 text-xs">
      {FLOW.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={cn('rounded px-2 py-0.5', i <= idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{s}</span>
          {i < FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

export function LoanTimeline({ status, entries }: { status: LoanStatus; entries?: TimelineEntry[] }) {
  if (!entries) return <StatusFlow status={status} />;
  const fmt = (s: string) => new Date(s).toLocaleString('en-IN');
  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{e.type}</p>
            <p className="text-xs text-muted-foreground">
              {fmt(e.at)} · {e.actor ? e.actor.name : 'system'}{e.detail ? ` · ${e.detail}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
