import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface LogoProps {
  /** `mark` renders the icon only, `full` adds the wordmark. */
  variant?: 'full' | 'mark';
  className?: string;
  /** Rendered as a router link by default. */
  to?: string;
}

/**
 * ResumeForge mark. Replace the inline <svg> below with your own logo file if
 * you have one — everything else stays the same.
 */
export function Logo({ variant = 'full', className, to = '/' }: LogoProps) {
  const glyph = (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-brand-400/40 bg-brand-500/10">
        <svg
          aria-hidden="true"
          viewBox="0 0 64 64"
          className="h-5 w-5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="rf-logo-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8389FF" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          <path
            d="M18 46V18h14.5c5 0 8.3 2.6 8.3 6.9 0 3.2-2 5.6-5.2 6.4 3.8.7 6.2 3.3 6.2 6.8 0 4.5-3.6 6.9-9.1 6.9H18zm6.7-15.9h6.8c2.2 0 3.5-1 3.5-2.7s-1.3-2.7-3.5-2.7h-6.8v5.4zm0 11.1h7.5c2.4 0 3.8-1.1 3.8-2.9s-1.4-2.9-3.8-2.9h-7.5v5.8z"
            fill="url(#rf-logo-gradient)"
          />
        </svg>
      </span>
      {variant === 'full' && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight">ResumeForge</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-faint">
            Resume Classification
          </span>
        </span>
      )}
    </span>
  );

  return (
    <Link
      to={to}
      aria-label="ResumeForge home"
      className={cn('inline-flex rounded-xl transition-opacity hover:opacity-85', className)}
    >
      {glyph}
    </Link>
  );
}
