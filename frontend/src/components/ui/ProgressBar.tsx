import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/cn';

export type BarTone = 'brand' | 'aqua' | 'success' | 'warn' | 'error' | 'neutral';

export interface ProgressBarProps {
  /** 0 - 1 */
  value: number;
  label?: string;
  /** Rendered to the right of the label, e.g. "62.4%". */
  valueLabel?: string;
  tone?: BarTone;
  size?: 'sm' | 'md' | 'lg';
  /** Delay in seconds before the fill animates. */
  delay?: number;
  className?: string;
  showTrack?: boolean;
}

const FILL: Record<BarTone, string> = {
  brand: 'bg-gradient-brand',
  aqua: 'bg-gradient-to-r from-aqua-500 to-aqua-300',
  success: 'bg-gradient-to-r from-mint/80 to-mint',
  warn: 'bg-gradient-to-r from-amber2/80 to-amber2',
  error: 'bg-gradient-to-r from-rose2/80 to-rose2',
  neutral: 'bg-gradient-to-r from-faint/70 to-muted',
};

/** Animated horizontal meter used for confidence and top-N predictions. */
export function ProgressBar({
  value,
  label,
  valueLabel,
  tone = 'brand',
  size = 'md',
  delay = 0,
  className,
  showTrack = true,
}: ProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const id = useId();
  const safeValue = clamp01(value);

  return (
    <div className={cn('w-full', className)}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && <span className="truncate text-sm text-content">{label}</span>}
          {valueLabel && (
            <span className="tabular shrink-0 text-sm font-semibold text-content">
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-elevated',
          showTrack && 'ring-1 ring-inset ring-line',
        )}
        style={{ height: size === 'sm' ? 6 : size === 'lg' ? 12 : 8 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue * 100)}
        aria-valuetext={valueLabel}
        aria-labelledby={label ? id : undefined}
      >
        <motion.div
          id={label ? id : undefined}
          className={cn('h-full rounded-full', FILL[tone])}
          initial={prefersReducedMotion ? false : { width: 0 }}
          animate={{ width: `${safeValue * 100}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </div>
    </div>
  );
}
