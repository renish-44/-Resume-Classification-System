import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertOctagon,
  ArrowRightCircle,
  CheckCircle2,
  Database,
  FlaskConical,
  Layers,
  Rocket,
  Wrench,
} from 'lucide-react';
import { SITE } from '@/data/site';
import { dataset } from '@/data/results';
import {
  frontendStack,
  futureWork,
  limitations,
  methodologyTimeline,
  mlStack,
  preprocessingDecisions,
  validationPractices,
} from '@/data/content';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Container, Section } from '@/components/ui/Container';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Reveal';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/cn';

function Timeline() {
  const [active, setActive] = useState(0);
  const current = methodologyTimeline[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <ol className="space-y-1.5">
        {methodologyTimeline.map((item, index) => {
          const isActive = index === active;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300',
                  isActive
                    ? 'border-brand-400/50 bg-brand-500/10'
                    : 'border-line bg-surface/40 hover:border-brand-400/40',
                )}
              >
                <span
                  className={cn(
                    'tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                    isActive ? 'bg-gradient-brand text-white' : 'bg-elevated text-faint',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-[11px] text-faint">{item.status}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Card tone="glass" className="flex min-h-[220px] flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
          Step {active + 1} of {methodologyTimeline.length}
        </p>
        <h3 className="mt-3 text-xl font-semibold">{current.title}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{current.description}</p>
      </Card>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: 'warn' | 'good' }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              tone === 'warn' ? 'bg-amber2/12 text-amber2' : 'bg-mint/12 text-mint',
            )}
          >
            {tone === 'warn' ? (
              <AlertOctagon className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function StackBadges({
  title,
  items,
  icon,
}: {
  title: string;
  items: typeof frontendStack;
  icon: ReactNode;
}) {
  return (
    <Card tone="outline" padded={false} className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
          {icon}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.name}>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs">
              <span className="font-medium text-content">{item.name}</span>
              <span className="text-faint">{item.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function AboutPage() {
  useDocumentMeta(
    `About — ${SITE.name}`,
    `Methodology, dataset, preprocessing decisions, validation rigor and limitations behind ${SITE.name}, built for ${SITE.hackathon}.`,
  );

  return (
    <>
      <Section className="pb-6 pt-14 sm:pt-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Badge tone="brand" dot>
                About the project
              </Badge>
              <h1 className="mt-5 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
                A complete resume classification pipeline, not a single model.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                {SITE.name} starts with a CSV of extracted resume text and ends with a single label
                plus an honest confidence score. The path in between is documented below: audit,
                exploration, preprocessing, feature engineering, four models, one held-out
                evaluation, error analysis, and a prediction API this site talks to.
              </p>
            </div>

            <div className="lg:col-span-5">
              <Card tone="gradient">
                <dl className="grid grid-cols-2 gap-5">
                  {[
                    ['Dataset file', dataset.fileName],
                    ['Input column', dataset.inputField],
                    ['Target column', dataset.targetField],
                    ['Resumes', formatCount(dataset.totalResumes)],
                    ['Categories', formatCount(dataset.totalCategories)],
                    ['Split', 'Stratified'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                        {label}
                      </dt>
                      <dd className="mt-1 truncate text-sm font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </div>
        </Container>
      </Section>

      {/* ---- Methodology timeline ---------------------------------------- */}
      <Section divided id="methodology" className="py-12 sm:py-14">
        <Container>
          <div className="mb-10">
            <Badge tone="neutral" icon={<FlaskConical className="h-3 w-3" aria-hidden="true" />}>
              Methodology
            </Badge>
            <h2 className="mt-4 text-2xl sm:text-3xl">From problem statement to live demo</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Ten stages, in the order they actually happened. Pick one to read what was done.
            </p>
          </div>

          <Reveal>
            <Timeline />
          </Reveal>
        </Container>
      </Section>

      {/* ---- Dataset ------------------------------------------------------ */}
      <Section divided id="dataset" className="py-12 sm:py-14">
        <Container>
          <div className="mb-10 grid gap-6 lg:grid-cols-2 lg:items-end">
            <div>
              <Badge tone="neutral" icon={<Database className="h-3 w-3" aria-hidden="true" />}>
                Dataset
              </Badge>
              <h2 className="mt-4 text-2xl sm:text-3xl">Four columns, two of which matter</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted lg:pb-1">
              {dataset.redistributionNote} Update the counts and notes below in{' '}
              <code className="font-mono text-brand-200">src/data/results.ts</code>.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="data-table">
              <caption className="sr-only">Dataset columns and their role</caption>
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Role</th>
                  <th scope="col">How it is used</th>
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((column) => (
                  <tr key={column.name}>
                    <td className="font-mono text-xs font-semibold text-brand-200">
                      {column.name}
                    </td>
                    <td>
                      <Badge
                        tone={
                          column.role === 'Target'
                            ? 'success'
                            : column.role === 'Input'
                              ? 'brand'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {column.role}
                      </Badge>
                    </td>
                    <td className="max-w-md text-sm text-muted">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ['Input field', dataset.inputField],
              ['Target field', dataset.targetField],
              ['Unused fields', dataset.auxiliaryFields],
            ].map(([label, value]) => (
              <Card key={label} tone="outline" padded={false} className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                  {label}
                </p>
                <p className="mt-1.5 font-mono text-sm text-content">{value}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---- Preprocessing + validation ----------------------------------- */}
      <Section divided id="engineering" className="py-12 sm:py-14">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
                    <Wrench className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h2 className="text-xl font-semibold">Preprocessing decisions</h2>
                </div>
                <dl className="mt-6 space-y-5">
                  {preprocessingDecisions.map((item) => (
                    <div key={item.title}>
                      <dt className="text-sm font-semibold">{item.title}</dt>
                      <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-mint/30 bg-mint/10 text-mint">
                    <Layers className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <h2 className="text-xl font-semibold">Validation rigor</h2>
                </div>
                <dl className="mt-6 space-y-5">
                  {validationPractices.map((item) => (
                    <div key={item.title}>
                      <dt className="text-sm font-semibold">{item.title}</dt>
                      <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ---- Limitations & future work ------------------------------------ */}
      <Section divided id="limitations" className="py-12 sm:py-14">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card tone="outline">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber2/30 bg-amber2/10 text-amber2">
                  <AlertOctagon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-semibold">Known limitations</h2>
              </div>
              <BulletList items={limitations} tone="warn" />
            </Card>

            <Card tone="outline">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-aqua-400/30 bg-aqua-400/10 text-aqua-300">
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-semibold">Future improvements</h2>
              </div>
              <BulletList items={futureWork} tone="good" />
            </Card>
          </div>
        </Container>
      </Section>

      {/* ---- Stack -------------------------------------------------------- */}
      <Section divided id="stack" className="py-12 sm:py-14">
        <Container>
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl">Stack</h2>
            <p className="mt-2 max-w-2xl text-muted">
              The model side in Python, the product side in the browser. Both ship from the same
              repository.
            </p>
          </div>

          <Stagger className="grid gap-6 lg:grid-cols-2">
            <StaggerItem className="h-full">
              <StackBadges
                title="Model &amp; API"
                items={mlStack}
                icon={<ArrowRightCircle className="h-4 w-4" aria-hidden="true" />}
              />
            </StaggerItem>

            <StaggerItem className="h-full">
              <StackBadges
                title="Web app"
                items={frontendStack}
                icon={<Layers className="h-4 w-4" aria-hidden="true" />}
              />
            </StaggerItem>
          </Stagger>

          <p className="mt-8 text-xs leading-relaxed text-faint">
            Edit the stack lists in <code className="font-mono">src/data/content.ts</code>.
          </p>
        </Container>
      </Section>
    </>
  );
}
