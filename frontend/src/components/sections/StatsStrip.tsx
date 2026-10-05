import { Layers, ListChecks, Sparkles, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HeadlineStat } from '@/data/results';
import { headlineStats } from '@/data/results';
import { useCountUp } from '@/hooks/useCountUp';
import { Container, Section } from '@/components/ui/Container';
import { PendingBadge } from '@/components/ui/Badge';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';
import { EM_DASH, toNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

const ICONS: Record<string, LucideIcon> = {
  resumes: Layers,
  categories: ListChecks,
  'best-model': Trophy,
  'macro-f1': Sparkles,
};

function StatTile({ stat }: { stat: HeadlineStat }) {
  const Icon = ICONS[stat.id] ?? Layers;
  const numericValue = toNumber(stat.value);

  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition-colors hover:border-brand-400/40">
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand-500/15 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
      />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{stat.label}</p>
        <Icon className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
      </div>

      <div className="relative mt-3 flex min-h-[2.5rem] items-center">
        {stat.kind === 'text' ? (
          <p className="font-display text-2xl font-bold leading-tight">
            {numericValue === null && !stat.text ? <PendingBadge /> : (stat.text ?? stat.value)}
          </p>
        ) : (
          <StatValue stat={stat} value={numericValue} />
        )}
      </div>

      <p className="relative mt-2 text-xs leading-relaxed text-muted">{stat.hint}</p>
    </div>
  );
}

function StatValue({ stat, value }: { stat: HeadlineStat; value: number | null }) {
  const { ref, value: animated } = useCountUp<HTMLParagraphElement>(value);

  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-display text-2xl font-bold text-faint">{EM_DASH}</span>
        <PendingBadge />
      </div>
    );
  }

  const display =
    stat.kind === 'percent'
      ? `${(animated * 100).toFixed(1)}%`
      : Math.round(animated).toLocaleString('en-US');

  return (
    <p
      ref={ref}
      className={cn('tabular font-display text-3xl font-bold leading-none tracking-tight')}
    >
      {display}
    </p>
  );
}

export function StatsStrip() {
  return (
    <Section divided className="py-12 sm:py-14">
      <Container>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-faint">
          Everything below is read from{' '}
          <span className="font-mono text-brand-300">src/data/results.ts</span>
        </p>

        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {headlineStats.map((stat) => (
            <StaggerItem key={stat.id}>
              <StatTile stat={stat} />
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
