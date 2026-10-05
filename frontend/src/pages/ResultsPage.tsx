import { useState } from 'react';
import { AlertTriangle, CloudDownload, Filter, Percent, RefreshCw, Sparkles } from 'lucide-react';
import { SITE } from '@/data/site';
import type { ErrorRow, MetricValue, ModelMetricRow } from '@/data/results';
import { errorNotes, evaluationSetup, lowConfidenceThreshold } from '@/data/results';
import { resolveLowConfidenceThreshold } from '@/data/site';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { usingRealBackend } from '@/lib/api';
import { useResultsSource } from '@/hooks/useResultsSource';
import type { ResultsData } from '@/lib/results';
import {
  comparisonSeries,
  confusionErrors,
  confusionTotal,
  hasClassDistribution,
  hasConfusionMatrix,
  hasErrorRows,
  hasFullModelTable,
  hasLengthHistogram,
  hasModelMetrics,
  hasPerClassMetrics,
  highlightedModelId,
  isSeriesComplete,
} from '@/lib/results';
import {
  formatCount,
  formatDuration,
  formatPercent,
  PENDING_LABEL,
  toNumber,
  truncate,
} from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ChartFrame } from '@/components/ui/ChartFrame';
import { Container, Section } from '@/components/ui/Container';
import { DataTable } from '@/components/ui/DataTable';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { Heatmap } from '@/components/ui/Heatmap';
import { PendingState } from '@/components/ui/PendingState';
import { Reveal } from '@/components/ui/Reveal';
import { ClassDistributionChart } from '@/components/charts/ClassDistributionChart';
import { LengthHistogram } from '@/components/charts/LengthHistogram';
import { ModelComparisonChart } from '@/components/charts/ModelComparisonChart';
import { cn } from '@/lib/cn';

const THRESHOLD = resolveLowConfidenceThreshold(lowConfidenceThreshold);

/* -------------------------------------------------------------------------
 * Small presentational helpers
 * ---------------------------------------------------------------------- */

function MetricCell({ value, digits = 1 }: { value: MetricValue; digits?: number }) {
  const text = formatPercent(value, digits);

  if (text === PENDING_LABEL) {
    return (
      <span className="text-faint" title={`Pending \u2014 no value reported by the backend or src/data/results.ts`}>
        &mdash;
      </span>
    );
  }

  return <span className="tabular font-medium">{text}</span>;
}

function PendingNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-amber2/30 bg-amber2/[0.06] px-4 py-3 text-xs leading-relaxed text-amber2',
        className,
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Some values are still placeholders. Either drop the evaluation reports into{' '}
        <code className="font-mono">resumeforge-backend/reports/</code> (served by{' '}
        <code className="font-mono">GET /results</code>) or fill in{' '}
        <code className="font-mono">frontend/src/data/results.ts</code>. Nothing on this page is
        hard-coded and no value is invented.
      </span>
    </div>
  );
}

/** Shows where the current numbers came from: live API or the committed file. */
function SourceNotice({
  state,
  note,
  onReload,
}: {
  state: 'loading' | 'backend' | 'empty' | 'error';
  note: string;
  onReload: () => void;
}) {
  const live = state === 'backend';
  const busy = state === 'loading';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs',
        live
          ? 'border-mint/30 bg-mint/[0.06] text-mint'
          : busy
            ? 'border-line bg-surface/60 text-muted'
            : 'border-amber2/30 bg-amber2/[0.06] text-amber2',
      )}
      role="status"
    >
      <span className="flex min-w-0 items-center gap-2">
        {live ? (
          <CloudDownload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="leading-relaxed">{note}</span>
      </span>

      {usingRealBackend && (
        <button
          type="button"
          onClick={onReload}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 font-medium transition-opacity hover:opacity-75 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden="true" />
          Reload
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Page sections
 * ---------------------------------------------------------------------- */

function ModelTable({ data }: { data: ResultsData }) {
  const highlightedId = highlightedModelId(data);

  const columns: DataTableColumn<ModelMetricRow>[] = [
    {
      key: 'model',
      header: 'Model',
      sortable: true,
      sortValue: (row) => row.model,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="font-medium">{row.model}</span>
          {highlightedId === row.id && (
            <Badge
              tone="success"
              size="sm"
              icon={<Sparkles className="h-3 w-3" aria-hidden="true" />}
            >
              Best macro-F1
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.accuracy),
      render: (row) => <MetricCell value={row.accuracy} />,
    },
    {
      key: 'precision',
      header: 'Precision',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.precision),
      render: (row) => <MetricCell value={row.precision} />,
    },
    {
      key: 'recall',
      header: 'Recall',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.recall),
      render: (row) => <MetricCell value={row.recall} />,
    },
    {
      key: 'macroF1',
      header: 'Macro-F1',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.macroF1),
      render: (row) => <MetricCell value={row.macroF1} />,
    },
    {
      key: 'weightedF1',
      header: 'Weighted-F1',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.weightedF1),
      render: (row) => <MetricCell value={row.weightedF1} />,
    },
    {
      key: 'trainingTime',
      header: 'Training time',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.trainingTimeSec),
      render: (row) => <span className="tabular">{formatDuration(row.trainingTimeSec)}</span>,
    },
  ];

  const complete = hasFullModelTable(data);

  return (
    <div className="space-y-4">
      {!complete && <PendingNotice />}

      <DataTable
        columns={columns}
        rows={data.modelMetrics}
        getRowId={(row) => row.id}
        caption="Model comparison: accuracy, precision, recall, macro-F1, weighted-F1 and training time"
        initialSort={{ key: 'macroF1', direction: 'desc' }}
        rowHighlight={(row) => row.id === highlightedId}
        emptyMessage="No model rows available: the backend reported none and none are committed in src/data/results.ts."
      />

      <p className="text-xs leading-relaxed text-faint">
        The highlighted row is chosen by <strong className="text-muted">macro-F1</strong>, not
        accuracy: on a class-imbalanced dataset accuracy alone can look excellent while minority
        categories collapse.
      </p>
    </div>
  );
}

function PerClassTable({ data }: { data: ResultsData }) {
  const rows = data.perClassMetrics;

  if (!hasPerClassMetrics(data)) {
    return (
      <PendingState description="Pending — no per-class metrics from GET /results, and none committed in src/data/results.ts." />
    );
  }

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (row) => row.category,
      render: (row) => <span className="font-medium">{row.category}</span>,
    },
    {
      key: 'precision',
      header: 'Precision',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.precision),
      render: (row) => <MetricCell value={row.precision} />,
    },
    {
      key: 'recall',
      header: 'Recall',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.recall),
      render: (row) => <MetricCell value={row.recall} />,
    },
    {
      key: 'f1',
      header: 'F1',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.f1),
      render: (row) => <MetricCell value={row.f1} />,
    },
    {
      key: 'support',
      header: 'Support',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.support),
      render: (row) => <span className="tabular">{formatCount(row.support)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.category}
      caption="Per-class precision, recall, F1 and support"
      searchable
      searchPlaceholder="Search a category…"
      searchText={(row) => row.category}
      initialSort={{ key: 'support', direction: 'desc' }}
    />
  );
}

function ConfusionMatrixPanel({ data }: { data: ResultsData }) {
  const [normalize, setNormalize] = useState(false);
  const { labels, matrix } = data.confusionMatrix;
  const available = hasConfusionMatrix(data);
  const total = confusionTotal(data);
  const errors = confusionErrors(data);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Confusion matrix</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Rows are the true category, columns the predicted one. The diagonal is correct; the rest
            are the mistakes worth reading.
          </p>
        </div>

        {available && (
          <button
            type="button"
            onClick={() => setNormalize((value) => !value)}
            aria-pressed={normalize}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              normalize
                ? 'border-brand-400/50 bg-brand-500/10 text-brand-200'
                : 'border-line bg-surface/60 text-muted hover:text-content',
            )}
          >
            <Percent className="h-3.5 w-3.5" aria-hidden="true" />
            {normalize ? 'Showing percentages' : 'Showing counts'}
          </button>
        )}
      </div>

      <div className="mt-5">
        {!available ? (
          <PendingState description="Pending — the backend serves no confusion_matrix.json and none is committed in src/data/results.ts." />
        ) : (
          <>
            <Heatmap
              labels={labels}
              matrix={matrix}
              normalize={normalize}
              caption="Confusion matrix: true category versus predicted category"
            />
            <div className="tabular mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
              <span>Documents: {formatCount(total)}</span>
              <span>Misclassified: {formatCount(errors)}</span>
              <span>
                Error rate: {total > 0 ? formatPercent(errors / total, 1) : PENDING_LABEL}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function ErrorAnalysisPanel({ data }: { data: ResultsData }) {
  const [query, setQuery] = useState('');
  const [actualFilter, setActualFilter] = useState('all');
  const [predictedFilter, setPredictedFilter] = useState('all');
  const [lowOnly, setLowOnly] = useState(false);

  const actualOptions = Array.from(new Set(data.errorRows.map((row) => row.actual))).sort();
  const predictedOptions = Array.from(new Set(data.errorRows.map((row) => row.predicted))).sort();

  const rows = data.errorRows.filter((row) => {
    if (actualFilter !== 'all' && row.actual !== actualFilter) return false;
    if (predictedFilter !== 'all' && row.predicted !== predictedFilter) return false;
    if (lowOnly && (toNumber(row.confidence) ?? 1) >= THRESHOLD) return false;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      const haystack =
        `${row.id} ${row.actual} ${row.predicted} ${row.preview} ${row.suspectedCause ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const columns: DataTableColumn<ErrorRow>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      sortValue: (row) => row.id,
      render: (row) => <span className="font-mono text-xs">{row.id}</span>,
    },
    {
      key: 'actual',
      header: 'Actual',
      sortable: true,
      sortValue: (row) => row.actual,
      render: (row) => <span className="font-medium">{row.actual}</span>,
    },
    {
      key: 'predicted',
      header: 'Predicted',
      sortable: true,
      sortValue: (row) => row.predicted,
      render: (row) => <span className="text-brand-200">{row.predicted}</span>,
    },
    {
      key: 'confidence',
      header: 'Confidence',
      align: 'right',
      sortable: true,
      sortValue: (row) => toNumber(row.confidence),
      render: (row) => <MetricCell value={row.confidence} />,
    },
    {
      key: 'preview',
      header: 'Preview',
      render: (row) => (
        <span
          className="block max-w-[280px] truncate text-xs text-muted"
          title={truncate(row.preview, 160)}
        >
          {truncate(row.preview, 70)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ID, text, cause…"
            className="h-9 rounded-lg border border-line bg-app/60 px-3 text-sm font-normal text-content placeholder:text-faint focus:border-brand-400/70 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Actual category
          <select
            value={actualFilter}
            onChange={(event) => setActualFilter(event.target.value)}
            disabled={!hasErrorRows(data)}
            className="h-9 rounded-lg border border-line bg-app/60 px-3 text-sm font-normal text-content focus:border-brand-400/70 focus:outline-none disabled:opacity-50"
          >
            <option value="all">All</option>
            {actualOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Predicted category
          <select
            value={predictedFilter}
            onChange={(event) => setPredictedFilter(event.target.value)}
            disabled={!hasErrorRows(data)}
            className="h-9 rounded-lg border border-line bg-app/60 px-3 text-sm font-normal text-content focus:border-brand-400/70 focus:outline-none disabled:opacity-50"
          >
            <option value="all">All</option>
            {predictedOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2.5 self-end rounded-lg border border-line bg-app/60 px-3 py-2 text-xs font-medium text-muted">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => setLowOnly(event.target.checked)}
            disabled={!hasErrorRows(data)}
            className="h-4 w-4 accent-[rgb(var(--c-ring))] disabled:opacity-50"
          />
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Confidence &lt; {formatPercent(THRESHOLD, 0)}
        </label>
      </div>

      {!hasErrorRows(data) ? (
        <PendingState description="Pending — the backend serves no error_analysis.csv and none is committed in src/data/results.ts." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          caption="Misclassified resumes with actual label, predicted label and confidence"
          initialSort={{ key: 'confidence', direction: 'asc' }}
          emptyMessage="No misclassifications match these filters."
        />
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-faint">
          Why the model errs
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {errorNotes.map((note) => (
            <li key={note.title} className="rounded-2xl border border-line bg-surface/50 p-4">
              <p className="text-sm font-semibold">{note.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{note.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function ResultsPage() {
  useDocumentMeta(
    `Model Results — ${SITE.name}`,
    `Accuracy, precision, recall, macro-F1, weighted-F1, per-class metrics, confusion matrix and error analysis for ${SITE.name}.`,
  );

  const { data, note, state, reload } = useResultsSource();
  const series = comparisonSeries(data);
  const chartReady =
    hasModelMetrics(data) &&
    isSeriesComplete(
      series.flatMap((row) => [
        { value: row.accuracy },
        { value: row.macroF1 },
        { value: row.weightedF1 },
      ]),
    );

  return (
    <>
      <Section className="pb-2 pt-14 sm:pt-16">
        <Container>
          <div className="max-w-3xl">
            <Badge tone="brand" dot>
              Results dashboard
            </Badge>
            <h1 className="mt-5 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
              Every metric, in one place.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              Model comparison, per-class breakdown, confusion matrix and the mistakes that explain
              them. With a backend configured this page reads{' '}
              <code className="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-sm text-brand-200">
                GET /results
              </code>
              ; otherwise (or when the backend has no reports yet) it falls back to{' '}
              <code className="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-sm text-brand-200">
                src/data/results.ts
              </code>
              . Nothing is ever invented.
            </p>

            <div className="mt-6 max-w-2xl">
              <SourceNotice state={state} note={note} onReload={reload} />
            </div>
          </div>
        </Container>
      </Section>

      {/* ---- Model comparison table ------------------------------------- */}
      <Section id="model-comparison" className="py-8 sm:py-10">
        <Container>
          <Reveal>
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl">Model comparison</h2>
              <p className="mt-2 max-w-2xl text-muted">
                Sorted by macro-F1 by default. Click any column header to re-sort.
              </p>
            </div>
            <ModelTable data={data} />
          </Reveal>
        </Container>
      </Section>

      {/* ---- Grouped bar chart ----------------------------------------- */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <ChartFrame
            title="Accuracy vs macro-F1 vs weighted-F1"
            description="Grouped bars per model. The gap between accuracy and macro-F1 is where class imbalance shows up."
            pending={!chartReady}
            pendingDescription="Pending — no metrics from GET /results and none committed in src/data/results.ts. Charts are never drawn with invented values."
          >
            <ModelComparisonChart data={series} height={360} />
          </ChartFrame>
        </Container>
      </Section>

      {/* ---- Per-class metrics ----------------------------------------- */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl">Per-class metrics</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Where the model is strong, and where it quietly fails.
            </p>
          </div>
          <Reveal>
            <PerClassTable data={data} />
          </Reveal>
        </Container>
      </Section>

      {/* ---- Confusion matrix ------------------------------------------ */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl">Confusion matrix</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Toggle between raw counts and per-class percentages. Hover a cell for the detail.
            </p>
          </div>
          <Reveal>
            <ConfusionMatrixPanel data={data} />
          </Reveal>
        </Container>
      </Section>

      {/* ---- Distributions --------------------------------------------- */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl">Dataset shape</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Class balance and text length both influence how hard the task is.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartFrame
              title="Class distribution"
              description="How many resumes sit in each category."
              pending={!hasClassDistribution(data)}
              pendingDescription="Pending — add results to src/data/results.ts (classDistribution)."
            >
              <ClassDistributionChart data={data.classDistribution} />
            </ChartFrame>

            <ChartFrame
              title="Resume length histogram"
              description="Extracted characters per resume, bucketed."
              pending={!hasLengthHistogram(data)}
              pendingDescription="Pending — add results to src/data/results.ts (resumeLengthHistogram)."
            >
              <LengthHistogram data={data.resumeLengthHistogram} />
            </ChartFrame>
          </div>
        </Container>
      </Section>

      {/* ---- Error analysis -------------------------------------------- */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl">Error analysis</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Concrete misclassifications, plus the recurring patterns behind them.
            </p>
          </div>
          <Reveal>
            <ErrorAnalysisPanel data={data} />
          </Reveal>
        </Container>
      </Section>

      {/* ---- Evaluation setup ------------------------------------------ */}
      <Section divided className="py-10 sm:py-12">
        <Container>
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl">How these numbers were produced</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Editable notes &mdash; keep them accurate as your pipeline evolves.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {evaluationSetup.map((note) => (
              <Card key={note.label} tone="outline" padded={false} className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
                  {note.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{note.value}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
