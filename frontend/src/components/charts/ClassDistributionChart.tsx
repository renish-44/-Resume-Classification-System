import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DistributionSlice } from '@/data/results';
import { toNumber } from '@/lib/format';
import { ChartTooltip, LegendSwatch } from './ChartTooltip';

export interface ClassDistributionChartProps {
  data: DistributionSlice[];
  height?: number;
}

/** Horizontal bars keep long category names readable. */
export function ClassDistributionChart({ data, height = 420 }: ClassDistributionChartProps) {
  const rows = data
    .map((slice) => ({ name: slice.label, value: toNumber(slice.count) }))
    .filter((slice): slice is { name: string; value: number } => slice.value !== null)
    .sort((a, b) => b.value - a.value);

  const max = rows.reduce((peak, row) => Math.max(peak, row.value), 0) || 1;
  const palette = ['#6A63F5', '#8389FF', '#22D3EE', '#34D399', '#A78BFA', '#38BDF8', '#FBBF24'];

  return (
    <div>
      <div style={{ height: Math.max(height, rows.length * 34 + 24) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <defs>
              {rows.map((row, index) => (
                <linearGradient
                  key={row.name}
                  id={`dist-gradient-${index}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop
                    offset="0%"
                    stopColor={palette[index % palette.length]}
                    stopOpacity={0.95}
                  />
                  <stop
                    offset="100%"
                    stopColor={palette[index % palette.length]}
                    stopOpacity={0.35}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 6" horizontal={false} />
            <XAxis type="number" domain={[0, max]} tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={148} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--c-muted) / 0.06)' }}
              content={<ChartTooltip asPercent={false} />}
            />
            <Bar
              dataKey="value"
              name="Resumes"
              radius={[0, 6, 6, 0]}
              maxBarSize={22}
              animationDuration={800}
            >
              {rows.map((row, index) => (
                <Cell key={row.name} fill={`url(#dist-gradient-${index})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <LegendSwatch color="#6A63F5" label="Resumes per category (largest first)" />
      </div>
    </div>
  );
}
