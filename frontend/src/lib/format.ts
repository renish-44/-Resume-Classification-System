import type { MetricValue } from '@/data/results';
import { PENDING } from '@/data/results';
import { clamp01 } from './cn';

/** Shown everywhere a real value is missing. Never render a fake number. */
export const PENDING_LABEL = 'Pending';
export const EM_DASH = '\u2014';

/** True when a value is still a placeholder (or missing). */
export function isPending(value: MetricValue | null | undefined): boolean {
  return value === PENDING || value === null || value === undefined || Number.isNaN(Number(value));
}

/** Numeric form of a metric, or `null` when it is still pending. */
export function toNumber(value: MetricValue | null | undefined): number | null {
  if (isPending(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `0.931` -> `"93.1%"`. Pending -> `"Pending"`. */
export function formatPercent(value: MetricValue | null | undefined, digits = 1): string {
  const num = toNumber(value);
  if (num === null) return PENDING_LABEL;
  return `${(num * 100).toFixed(digits)}%`;
}

/** `240` -> `"240"`, `1240` -> `"1,240"`. Pending -> `"Pending"`. */
export function formatCount(value: MetricValue | null | undefined): string {
  const num = toNumber(value);
  if (num === null) return PENDING_LABEL;
  return num.toLocaleString('en-US');
}

/** `0.87` -> `"0.87s"`, `97.4` -> `"97.4s"`. Pending -> `"Pending"`. */
export function formatSeconds(value: MetricValue | null | undefined, digits = 1): string {
  const num = toNumber(value);
  if (num === null) return PENDING_LABEL;
  return `${num.toFixed(digits)}s`;
}

/** Compact duration for the training-time column. */
export function formatDuration(value: MetricValue | null | undefined): string {
  const num = toNumber(value);
  if (num === null) return PENDING_LABEL;
  if (num < 1) return `${Math.round(num * 1000)} ms`;
  if (num < 120) return `${num.toFixed(1)} s`;
  const minutes = Math.floor(num / 60);
  const seconds = Math.round(num % 60);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

/** `12480` -> `"12,480"`. */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** `12480` -> `"12.5k"`. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Chart-friendly 0-1 value, safe when pending. */
export function chartPercent(value: MetricValue | null | undefined): number | null {
  const num = toNumber(value);
  return num === null ? null : clamp01(num);
}

/** `"HR"` -> `"HR"`, `"Data Science"` -> `"Data Science"`. */
export function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Shortens a long string for table previews. */
export function truncate(value: string, max = 90): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}\u2026`;
}

/** `"pending"`-safe text join used inside table cells. */
export function textOrPending(value: string | null | undefined, pending = PENDING_LABEL): string {
  return value && value.trim().length > 0 ? value : pending;
}
