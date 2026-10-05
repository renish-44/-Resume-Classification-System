import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/** Single shimmering placeholder block. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />;
}

export interface SkeletonStackProps {
  /** Number of lines to fake. */
  lines?: number;
  className?: string;
}

export function SkeletonStack({ lines = 3, className }: SkeletonStackProps) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : index % 2 ? 'w-11/12' : 'w-full')}
        />
      ))}
    </div>
  );
}

export interface PendingStateProps {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  /** Overridable file hint so the copy always points at the right file. */
  fileHint?: string;
}

const DEFAULT_FILE_HINT = 'src/data/results.ts';

/**
 * The honest empty state: tells the viewer exactly what is missing and where to
 * add it. Never renders a placeholder chart or a fabricated number.
 */
export function PendingState({
  title = 'Results pending',
  description,
  fileHint = DEFAULT_FILE_HINT,
  className,
  compact = false,
}: PendingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber2/30 bg-amber2/[0.04] text-center',
        compact ? 'gap-2 px-5 py-8' : 'gap-3 px-6 py-12',
        className,
      )}
      role="status"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber2/30 bg-amber2/10 text-amber2">
        <FileWarning aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="font-display text-base font-semibold text-amber2">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {description ?? `Pending \u2014 add results to ${fileHint}`}
      </p>
    </div>
  );
}
