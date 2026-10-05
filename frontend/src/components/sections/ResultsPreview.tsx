import { ArrowRight, FileCode2 } from 'lucide-react';
import { comparisonSeries, hasModelMetrics, isSeriesComplete } from '@/lib/results';
import { LinkButton } from '@/components/ui/Button';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { Container, Section } from '@/components/ui/Container';
import { ModelComparisonChart } from '@/components/charts/ModelComparisonChart';

export function ResultsPreview() {
  const series = comparisonSeries();
  const complete = isSeriesComplete(
    series.flatMap((row) => [
      { value: row.accuracy },
      { value: row.macroF1 },
      { value: row.weightedF1 },
    ]),
  );
  const showChart = hasModelMetrics() && complete;

  return (
    <Section
      id="results-preview"
      eyebrow="Results preview"
      title="Numbers, not adjectives."
      description="Accuracy alone hides minority-class failures, so the full comparison lives on the Results page — macro-F1, per-class breakdowns, confusion matrix and misclassified examples."
    >
      <Container>
        <ChartFrame
          title="Model comparison"
          description="Accuracy vs macro-F1 vs weighted-F1 for every model on the same held-out split."
          pending={!showChart}
          pendingDescription="Pending — add results to src/data/results.ts. Nothing is drawn until real values exist."
          className="mx-auto max-w-4xl"
        >
          <ModelComparisonChart data={series} />
        </ChartFrame>

        <div className="mt-8 flex flex-col items-center gap-4">
          <LinkButton
            to="/results"
            iconRight={
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            }
          >
            View full results &amp; error analysis
          </LinkButton>

          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-line bg-surface/50 px-5 py-3">
            <FileCode2 className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted">
              Every figure on this site is read from a single editable file, so no metric is ever
              hard-coded into a component.
            </p>
            <code className="rounded-md border border-line bg-elevated px-2 py-1 font-mono text-[11px] text-brand-200">
              src/data/results.ts
            </code>
          </div>
        </div>
      </Container>
    </Section>
  );
}
