import { useState } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/cn';

export interface HeatmapProps {
  /** Class labels — both axis order (row = true, column = predicted). */
  labels: string[];
  /** 2D array matching `labels` length. */
  matrix: number[][];
  /** Show each row as a percentage of that true class. */
  normalize?: boolean;
  caption: string;
  className?: string;
}

interface TooltipState {
  x: number;
  y: number;
  trueLabel: string;
  predictedLabel: string;
  value: number;
  rowTotal: number;
}

const LOW = 'rgba(106, 99, 245, 0.06)';
const HIGH = 'rgba(34, 211, 238, 0.92)';

/** Blue -> cyan interpolation so high counts read as "hot". */
function cellColor(intensity: number): string {
  const alpha = 0.06 + intensity * 0.86;
  const hueShift = intensity > 0.5;
  return hueShift ? `rgba(34, 211, 238, ${alpha})` : `rgba(106, 99, 245, ${alpha})`;
}

/**
 * Confusion-matrix heatmap rendered as a real <table> (sticky row headers,
 * screen-reader friendly). Hover shows a tooltip; a normalize toggle switches
 * between counts and per-class percentages.
 */
export function Heatmap({ labels, matrix, normalize = false, caption, className }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const rowTotals = labels.map(
    (_, rowIndex) =>
      matrix[rowIndex]?.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) ?? 0,
  );
  const grandTotal = rowTotals.reduce((sum, value) => sum + value, 0);
  const maxValue = matrix.reduce(
    (max, row) => row.reduce((rowMax, value) => Math.max(rowMax, value), max),
    0,
  );

  const displayValue = (value: number, rowIndex: number): string => {
    if (!normalize) return String(value);
    const total = rowTotals[rowIndex] || 1;
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const intensity = (value: number): number => (maxValue > 0 ? value / maxValue : 0);

  const moveTooltip = (
    event: MouseEvent<HTMLTableCellElement>,
    trueLabel: string,
    predictedLabel: string,
    value: number,
    rowIndex: number,
  ) => {
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      trueLabel,
      predictedLabel,
      value,
      rowTotal: rowTotals[rowIndex],
    });
  };

  return (
    <div className={cn('relative', className)}>
      <div className="max-h-[560px] overflow-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 bg-surface px-3 py-2 text-left font-semibold text-muted"
              >
                True \ Pred
              </th>
              {labels.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="sticky top-0 z-10 bg-surface px-2 py-2 text-center font-semibold text-muted"
                >
                  <span className="block origin-bottom-left -rotate-45 whitespace-nowrap px-1 pb-1 pt-4">
                    {label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={labels[rowIndex] ?? rowIndex}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 text-left font-medium text-content"
                >
                  {labels[rowIndex]}
                </th>
                {row.map((value, colIndex) => {
                  const diagonal = rowIndex === colIndex;
                  const shade = intensity(value);

                  return (
                    <td
                      key={labels[colIndex] ?? colIndex}
                      className={cn(
                        'p-0.5 text-center transition-transform hover:scale-[1.04]',
                        diagonal && 'font-semibold',
                      )}
                      onMouseMove={(event) =>
                        moveTooltip(event, labels[rowIndex], labels[colIndex], value, rowIndex)
                      }
                      onMouseLeave={() => setTooltip(null)}
                      title={`${labels[rowIndex]} \u2192 ${labels[colIndex]}: ${value}`}
                    >
                      <div
                        className={cn(
                          'tabular flex h-9 min-w-[44px] items-center justify-center rounded-md text-[11px]',
                          shade > 0.55 ? 'text-app' : 'text-content',
                          diagonal && 'ring-1 ring-inset ring-white/25',
                        )}
                        style={{
                          backgroundColor: shade > 0.55 ? cellColor(shade) : LOW,
                          opacity: normalize ? 0.35 + shade * 0.65 : 1,
                        }}
                        aria-label={`True ${labels[rowIndex]}, predicted ${labels[colIndex]}: ${value}${
                          normalize ? ` (${displayValue(value, rowIndex)})` : ''
                        }`}
                      >
                        {displayValue(value, rowIndex)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <div className="flex items-center gap-2">
          <span>0</span>
          <span
            aria-hidden="true"
            className="h-2 w-28 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${LOW}, ${HIGH})` }}
          />
          <span>{normalize ? '100% of class' : String(maxValue)}</span>
        </div>
        <div className="tabular flex flex-wrap items-center gap-4">
          <span>Total: {grandTotal.toLocaleString('en-US')}</span>
          <span>
            Cells: {labels.length}&times;{labels.length}
          </span>
        </div>
      </div>

      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-line bg-elevated px-3 py-2 text-xs shadow-lift"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold text-content">
            {tooltip.trueLabel} &rarr; {tooltip.predictedLabel}
          </p>
          <p className="tabular text-muted">
            {tooltip.value} document{tooltip.value === 1 ? '' : 's'}
            {tooltip.rowTotal > 0 &&
              ` (${((tooltip.value / tooltip.rowTotal) * 100).toFixed(1)}% of ${tooltip.trueLabel})`}
          </p>
        </div>
      )}
    </div>
  );
}
