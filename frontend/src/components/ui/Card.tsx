import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CardTone = 'default' | 'glass' | 'gradient' | 'outline';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  /** Adds the hover lift + accent border transition. */
  interactive?: boolean;
  padded?: boolean;
}

const TONES: Record<CardTone, string> = {
  default: 'bg-surface/80 border border-line',
  glass: 'glass',
  gradient: 'bg-gradient-brand-soft border border-brand-400/25',
  outline: 'border border-line bg-transparent',
};

/** The base surface used by every section. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = 'default', interactive = false, padded = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-2xl shadow-card',
        TONES[tone],
        padded && 'p-6',
        interactive && 'card-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({
  icon,
  eyebrow,
  title,
  description,
  action,
  className,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)} {...rest}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
              {eyebrow}
            </p>
          )}
          <h3 className="text-lg font-semibold leading-snug">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-4', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-5 flex flex-wrap items-center gap-3', className)} {...rest}>
      {children}
    </div>
  );
}
