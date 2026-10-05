import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warn' | 'error';

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** Announce changes to assistive tech (used for API failures). */
  live?: boolean;
}

const TONES: Record<AlertTone, { wrapper: string; icon: ReactNode; role: 'alert' | 'status' }> = {
  info: {
    wrapper: 'border-sky2/35 bg-sky2/[0.08] text-sky2',
    icon: <Info aria-hidden="true" className="h-4 w-4" />,
    role: 'status',
  },
  success: {
    wrapper: 'border-mint/35 bg-mint/[0.08] text-mint',
    icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" />,
    role: 'status',
  },
  warn: {
    wrapper: 'border-amber2/40 bg-amber2/[0.08] text-amber2',
    icon: <AlertTriangle aria-hidden="true" className="h-4 w-4" />,
    role: 'status',
  },
  error: {
    wrapper: 'border-rose2/40 bg-rose2/[0.08] text-rose2',
    icon: <XCircle aria-hidden="true" className="h-4 w-4" />,
    role: 'alert',
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  onDismiss,
  className,
  live = false,
}: AlertProps) {
  const config = TONES[tone];

  return (
    <div
      role={live ? config.role : undefined}
      aria-live={live ? (tone === 'error' ? 'assertive' : 'polite') : undefined}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed',
        config.wrapper,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon ?? config.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('text-content/85', title && 'mt-0.5')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 shrink-0 rounded-lg p-1 text-current transition hover:bg-elevated/60"
          aria-label="Dismiss message"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
