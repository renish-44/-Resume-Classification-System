import { motion } from 'framer-motion';
import { BrainCircuit, Cpu, Sparkles } from 'lucide-react';
import type { ModelMetricRow } from '@/data/results';
import { modelMetrics } from '@/data/results';
import { bestModel, highlightedModelId } from '@/lib/results';
import { formatDuration, formatPercent } from '@/lib/format';
import { Badge, PendingBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Container, Section } from '@/components/ui/Container';
import { LinkButton } from '@/components/ui/Button';
import { IN_VIEW } from '@/lib/motion';

function MetricChip({ row }: { row: ModelMetricRow }) {
  const chip = formatPercent(row.macroF1, 1);
  const pending = chip === 'Pending';

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={pending ? 'pending' : 'brand'}>Macro-F1{pending ? '' : ` \u00b7 ${chip}`}</Badge>
      {pending && <PendingBadge label="Metric pending" />}
    </span>
  );
}

export function ModelsShowcase() {
  const best = bestModel();
  const highlightedId = highlightedModelId();

  return (
    <Section
      id="models"
      eyebrow="Models"
      title="Four classifiers, one leaderboard."
      description="A fast probabilistic baseline, two strong linear models, and a sequence model — evaluated on the same split so the comparison means something."
    >
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modelMetrics.map((row, index) => {
            const isBest = best?.id === row.id;
            const isSelected = highlightedId === row.id;

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={IN_VIEW}
                transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                <Card
                  interactive
                  className={`flex h-full flex-col ${isSelected ? 'border-brand-400/50 bg-gradient-brand-soft' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        row.family === 'Deep learning'
                          ? 'border-aqua-400/30 bg-aqua-400/10 text-aqua-300'
                          : 'border-brand-400/30 bg-brand-500/10 text-brand-300'
                      }`}
                    >
                      {row.family === 'Deep learning' ? (
                        <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Cpu className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <Badge tone={row.family === 'Deep learning' ? 'brand' : 'neutral'} size="sm">
                      {row.family}
                    </Badge>
                  </div>

                  <h3 className="mt-5 text-base font-semibold leading-snug">{row.model}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {row.description}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <MetricChip row={row} />
                    {isBest && (
                      <Badge
                        tone="success"
                        size="sm"
                        icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
                      >
                        Best macro-F1
                      </Badge>
                    )}
                  </div>

                  <p className="tabular mt-4 border-t border-line pt-4 text-xs text-faint">
                    Training time: {formatDuration(row.trainingTimeSec)}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <LinkButton to="/results" variant="secondary">
            See the full comparison table
          </LinkButton>
        </div>
      </Container>
    </Section>
  );
}
