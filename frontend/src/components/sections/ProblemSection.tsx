import { ArrowRight, Check, X } from 'lucide-react';
import { problemPoints } from '@/data/content';
import { Container, Section } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';

function PointList({ items, tone }: { items: string[]; tone: 'bad' | 'good' }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <span
            aria-hidden="true"
            className={
              tone === 'bad'
                ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose2/12 text-rose2'
                : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/12 text-mint'
            }
          >
            {tone === 'bad' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ProblemSection() {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="Manual resume sorting does not scale — or repeat itself."
      description="Every posting generates a fresh pile of near-identical documents. Reading them one by one is slow, and the labels drift with fatigue, workload and time of day."
    >
      <Container>
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal>
            <Card className="h-full" interactive>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose2/30 bg-rose2/10 text-rose2">
                  <X className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">Manual triage</h3>
              </div>
              <PointList items={problemPoints.manual} tone="bad" />
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="h-full border-brand-400/30 bg-gradient-brand-soft" interactive>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-400/35 bg-brand-500/15 text-brand-200">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">ML-based organisation</h3>
              </div>
              <PointList items={problemPoints.ml} tone="good" />
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-10 flex max-w-3xl items-center justify-center gap-2 text-center text-sm text-muted">
            ResumeForge does not decide who gets hired. It decides{' '}
            <span className="font-medium text-content">where a resume is filed</span> — and shows
            its uncertainty while doing it.
            <ArrowRight
              className="hidden h-4 w-4 shrink-0 text-brand-300 sm:block"
              aria-hidden="true"
            />
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
