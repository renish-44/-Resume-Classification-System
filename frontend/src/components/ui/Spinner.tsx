import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SpinnerProps {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};

/** Indeterminate progress indicator with an accessible live label. */
export function Spinner({ className, label = 'Loading', size = 'md' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2
        aria-hidden="true"
        className={cn('animate-spin text-brand-300', SIZES[size], className)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Full-panel loading state used while a prediction is in flight. */
export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <Spinner size="lg" label={label} />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
