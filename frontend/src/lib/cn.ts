/** Tiny class-name joiner — avoids pulling in clsx for 20 lines of logic. */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Joins truthy class names into a single string. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(' ');
}

/** Clamps a number into the [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamps a 0-1 value into the percentage range used by charts and gauges. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
