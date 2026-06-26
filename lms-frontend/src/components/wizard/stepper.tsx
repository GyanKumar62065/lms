import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const state = i < current ? 'complete' : i === current ? 'active' : 'upcoming';
        return (
          <li key={label} data-state={state} className="flex items-center gap-2">
            <span
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full border text-xs',
                state === 'complete' && 'bg-primary text-primary-foreground border-primary',
                state === 'active' && 'border-primary text-primary font-semibold',
                state === 'upcoming' && 'text-muted-foreground',
              )}
            >
              {state === 'complete' ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('text-sm', state === 'upcoming' && 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
