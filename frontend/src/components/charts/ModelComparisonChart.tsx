import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS, ChartTooltip, LegendSwatch } from './ChartTooltip';
import type { ComparisonDatum } from '@/lib/results';

export interface ModelComparisonChartProps {
  data: ComparisonDatum[];
  height?: number;
}

const SERIES = [
  { key: 'accuracy' as const, label: 'Accuracy', color: CHART_COLORS.accuracy },
  { key: 'macroF1' as const, label: 'Macro-F1', color: CHART_COLORS.macroF1 },
  { key: 'weightedF1' as const, label: 'Weighted-F1', color: CHART_COLORS.weightedF1 },
];

/** Grouped bar chart: Accuracy vs Macro-F1 vs Weighted-F1 per model. */
export function ModelComparisonChart({ data, height = 340 }: ModelComparisonChartProps) {
  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 48 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-14}
              textAnchor="end"
              height={64}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              tick={{ fontSize: 12 }}
              width={56}
            />
            <Tooltip
              cursor={{ fill: 'rgb(var(--c-muted) / 0.06)' }}
              content={<ChartTooltip asPercent digits={1} />}
            />
            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={series.color}
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
                animationDuration={900}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        {SERIES.map((series) => (
          <LegendSwatch key={series.key} color={series.color} label={series.label} />
        ))}
      </div>
    </div>
  );
}
