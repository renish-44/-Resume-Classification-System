import { motion, useReducedMotion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { clamp01 } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

export type GaugeTone = 'success' | 'warn' | 'error' | 'brand';

export interface GaugeProps {
  /** 0 - 1 */
  value: number;
  /** Text rendered in the middle. Defaults to the percentage. */
  displayValue?: string;
  caption?: string;
  size?: number;
  strokeWidth?: number;
  tone?: GaugeTone;
  label?: string;
  className?: string;
}

const TONE_COLORS: Record<GaugeTone, string> = {
  success: '#34D399',
  warn: '#FBBF24',
  error: '#FB7185',
  brand: '#8389FF',
};

const GRADIENTS: Record<GaugeTone, [string, string]> = {
  success: ['#34D399', '#A7F3D0'],
  warn: ['#FBBF24', '#FDE68A'],
  error: ['#FB7185', '#FECDD3'],
  brand: ['#6A63F5', '#22D3EE'],
};

/** Animated circular confidence gauge. Pure SVG, no chart library. */
export function Gauge({
  value,
  displayValue,
  caption,
  size = 180,
  strokeWidth = 12,
  tone = 'brand',
  label,
  className,
}: GaugeProps) {
  const prefersReducedMotion = useReducedMotion();
  const gradientId = useId();
  const safeValue = clamp01(value);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeValue);
  const center = size / 2;
  const [from, to] = GRADIENTS[tone];

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Confidence ${formatPercent(safeValue, 1)}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgb(var(--c-muted) / 0.16)"
          strokeWidth={strokeWidth}
        />

        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${center} ${center})`}
          initial={
            prefersReducedMotion
              ? { strokeDashoffset: dashOffset }
              : { strokeDashoffset: circumference }
          }
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${TONE_COLORS[tone]}55)` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular font-display text-3xl font-bold tracking-tight">
          {displayValue ?? formatPercent(safeValue, 1)}
        </span>
        {caption && (
          <span className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-faint">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
