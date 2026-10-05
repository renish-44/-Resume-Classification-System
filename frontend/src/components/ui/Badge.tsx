import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warn' | 'error' | 'pending';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-elevated/70 text-muted',
  brand: 'border-brand-400/35 bg-brand-500/12 text-brand-200',
  success: 'border-mint/35 bg-mint/10 text-mint',
  warn: 'border-amber2/40 bg-amber2/10 text-amber2',
  error: 'border-rose2/40 bg-rose2/10 text-rose2',
  pending: 'border-amber2/30 bg-amber2/[0.07] text-amber2',
};

const DOT_COLORS: Record<BadgeTone, string> = {
  neutral: 'bg-faint',
  brand: 'bg-brand-400',
  success: 'bg-mint',
  warn: 'bg-amber2',
  error: 'bg-rose2',
  pending: 'bg-amber2/70',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-6 px-2 text-[11px] gap-1',
  md: 'h-7 px-2.5 text-xs gap-1.5',
};

export function Badge({
  tone = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border font-medium',
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[tone])} />
      )}
      {icon}
      {children}
    </span>
  );
}

/**
 * The single visual language for "we do not have real numbers yet".
 * Rendered instead of charts/tables whose data is still pending.
 */
export function PendingBadge({ label = 'Pending' }: { label?: string }) {
  return (
    <Badge tone="pending" dot>
      {label}
    </Badge>
  );
}
