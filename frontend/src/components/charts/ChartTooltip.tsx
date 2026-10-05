import type { ReactNode } from 'react';
import { formatPercent } from '@/lib/format';

/** Minimal shape Recharts injects into a custom tooltip. */
export interface ChartTooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
  label?: string | number;
  /** Render values as percentages of 1 (default) or as plain numbers. */
  asPercent?: boolean;
  digits?: number;
  labelFormatter?: (label: string) => ReactNode;
  emptyMessage?: string;
}

/** Shared dark/light-aware Recharts tooltip. */
export function ChartTooltip({
  active,
  payload,
  label,
  asPercent = true,
  digits = 1,
  labelFormatter,
  emptyMessage = 'No data',
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return <div className="hidden">{emptyMessage}</div>;
  }

  return (
    <div className="glass-strong rounded-xl px-3.5 py-3 text-xs shadow-lift">
      <p className="mb-2 font-semibold text-content">
        {labelFormatter ? labelFormatter(String(label ?? '')) : String(label ?? '')}
      </p>
      <ul className="space-y-1.5">
        {payload.map((item, index) => {
          const raw = typeof item.value === 'number' ? item.value : Number(item.value);
          const value = Number.isFinite(raw)
            ? asPercent
              ? formatPercent(raw, digits)
              : raw.toLocaleString('en-US')
            : String(item.value ?? '\u2014');

          return (
            <li key={`${String(item.dataKey)}-${index}`} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted">{String(item.name ?? item.dataKey ?? '')}</span>
              <span className="tabular ml-auto pl-4 font-semibold text-content">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface LegendSwatchProps {
  color: string;
  label: string;
}

/** Inline legend item used under charts. */
export function LegendSwatch({ color, label }: LegendSwatchProps) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/** Shared chart palette so every chart reads as one system. */
export const CHART_COLORS = {
  accuracy: '#8389FF',
  macroF1: '#22D3EE',
  weightedF1: '#A78BFA',
  primary: '#6A63F5',
  secondary: '#22D3EE',
  tertiary: '#34D399',
} as const;
