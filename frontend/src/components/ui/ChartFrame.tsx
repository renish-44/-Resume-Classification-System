import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './Card';
import { PendingState } from './PendingState';

export interface ChartFrameProps {
  title: string;
  description?: ReactNode;
  /** Controls rendered on the header row (e.g. a normalize toggle). */
  action?: ReactNode;
  legend?: ReactNode;
  /** Renders the pending state instead of children. */
  pending?: boolean;
  pendingDescription?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Consistent wrapper for every chart: title, description, optional action and
 * a guaranteed "pending" fallback so no chart can ever render invented data.
 */
export function ChartFrame({
  title,
  description,
  action,
  legend,
  pending = false,
  pendingDescription,
  children,
  className,
  bodyClassName,
}: ChartFrameProps) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">{title}</h3>
          {description && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>

      <div className={cn('mt-5 flex-1', bodyClassName)}>
        {pending ? <PendingState description={pendingDescription} /> : children}
      </div>

      {legend && !pending && <div className="mt-4 flex flex-wrap items-center gap-4">{legend}</div>}
    </Card>
  );
}
