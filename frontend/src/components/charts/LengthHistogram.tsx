import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetricValue } from '@/data/results';
import { toNumber } from '@/lib/format';
import { ChartTooltip, LegendSwatch } from './ChartTooltip';

export interface LengthHistogramProps {
  data: { bucket: string; count: MetricValue }[];
  height?: number;
}

/** Distribution of extracted resume text length (character buckets). */
export function LengthHistogram({ data, height = 320 }: LengthHistogramProps) {
  const rows = data
    .map((bucket) => ({ name: bucket.bucket, value: toNumber(bucket.count) }))
    .filter((bucket): bucket is { name: string; value: number } => bucket.value !== null);

  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
            <defs>
              <linearGradient id="hist-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#6A63F5" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={56}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={48} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--c-muted) / 0.06)' }}
              content={<ChartTooltip asPercent={false} />}
            />
            <Bar
              dataKey="value"
              name="Resumes"
              fill="url(#hist-fill)"
              radius={[6, 6, 0, 0]}
              maxBarSize={54}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <LegendSwatch color="#22D3EE" label="Resumes per extracted-length bucket" />
      </div>
    </div>
  );
}
