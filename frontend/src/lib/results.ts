import type {
  ClassMetricRow,
  ConfusionMatrixData,
  DistributionSlice,
  ErrorRow,
  MetricValue,
  ModelMetricRow,
} from '@/data/results';
import {
  classDistribution,
  confusionMatrix,
  errorRows,
  headlineStats,
  modelMetrics,
  perClassMetrics,
  resumeLengthHistogram,
  selectedModelId,
} from '@/data/results';
import type { ResultsSource } from './resultsApi';
import { toNumber } from './format';

/* -------------------------------------------------------------------------
 * Data source
 * ---------------------------------------------------------------------- */

/**
 * Everything the selectors below read. Defaults to the values committed in
 * `src/data/results.ts`; the Results page passes the mapped backend payload when
 * `GET /results` had something real to say.
 */
export type ResultsData = ResultsSource;

export const STATIC_RESULTS: ResultsData = {
  origin: 'file',
  modelMetrics,
  perClassMetrics,
  confusionMatrix,
  errorRows,
  classDistribution,
  resumeLengthHistogram,
};

/* -------------------------------------------------------------------------
 * Availability checks — every chart/table asks these before rendering data.
 * ---------------------------------------------------------------------- */

/** True when at least one headline stat has a real value. */
export function hasHeadlineStats(): boolean {
  return headlineStats.some((stat) => {
    if (stat.kind === 'text') return Boolean(stat.text);
    return toNumber(stat.value) !== null;
  });
}

/** True when at least one model has a real macro-F1. */
export function hasModelMetrics(data: ResultsData = STATIC_RESULTS): boolean {
  return data.modelMetrics.some((row) => toNumber(row.macroF1) !== null);
}

/** True when the full accuracy/precision/recall/F1 grid is filled in. */
export function hasFullModelTable(data: ResultsData = STATIC_RESULTS): boolean {
  return (
    data.modelMetrics.length > 0 &&
    data.modelMetrics.every(
      (row) =>
        toNumber(row.accuracy) !== null &&
        toNumber(row.precision) !== null &&
        toNumber(row.recall) !== null &&
        toNumber(row.macroF1) !== null &&
        toNumber(row.weightedF1) !== null,
    )
  );
}

export function hasPerClassMetrics(data: ResultsData = STATIC_RESULTS): boolean {
  return (
    data.perClassMetrics.length > 0 && data.perClassMetrics.some((row) => toNumber(row.f1) !== null)
  );
}

export function hasConfusionMatrix(data: ResultsData = STATIC_RESULTS): boolean {
  const { labels, matrix } = data.confusionMatrix;
  return labels.length > 0 && matrix.length > 0;
}

export function hasClassDistribution(data: ResultsData = STATIC_RESULTS): boolean {
  return (
    data.classDistribution.length > 0 &&
    data.classDistribution.some((row) => toNumber(row.count) !== null)
  );
}

export function hasLengthHistogram(data: ResultsData = STATIC_RESULTS): boolean {
  return (
    data.resumeLengthHistogram.length > 0 &&
    data.resumeLengthHistogram.some((row) => toNumber(row.count) !== null)
  );
}

export function hasErrorRows(data: ResultsData = STATIC_RESULTS): boolean {
  return data.errorRows.length > 0 && data.errorRows.some((row) => toNumber(row.confidence) !== null);
}

/* -------------------------------------------------------------------------
 * Derived values
 * ---------------------------------------------------------------------- */

/**
 * Best model by macro-F1 (never by accuracy alone — accuracy hides
 * minority-class failure on an imbalanced dataset).
 */
export function bestModel(data: ResultsData = STATIC_RESULTS): ModelMetricRow | null {
  const scored = data.modelMetrics
    .map((row) => ({ row, score: toNumber(row.macroF1) }))
    .filter((entry): entry is { row: ModelMetricRow; score: number } => entry.score !== null);

  if (scored.length === 0) return null;

  return scored.reduce((best, entry) => (entry.score > best.score ? entry : best)).row;
}

/**
 * Row to highlight in the comparison table: the explicit `selectedModelId`
 * when it is set, otherwise the macro-F1 leader.
 */
export function highlightedModelId(data: ResultsData = STATIC_RESULTS): string | null {
  if (selectedModelId && data.modelMetrics.some((row) => row.id === selectedModelId)) {
    return selectedModelId;
  }
  return bestModel(data)?.id ?? null;
}

export interface ComparisonDatum {
  name: string;
  accuracy: number | null;
  macroF1: number | null;
  weightedF1: number | null;
}

/** Series consumed by the grouped bar chart. */
export function comparisonSeries(data: ResultsData = STATIC_RESULTS): ComparisonDatum[] {
  return data.modelMetrics.map((row) => ({
    name: row.model,
    accuracy: toNumber(row.accuracy),
    macroF1: toNumber(row.macroF1),
    weightedF1: toNumber(row.weightedF1),
  }));
}

/** True when every bar of a chart has a value (so we never draw a partial chart). */
export function isSeriesComplete(series: { value: number | null }[]): boolean {
  return series.length > 0 && series.every((point) => point.value !== null);
}

/** Largest confusion-matrix cell value, used for the colour scale. */
export function confusionMax(data: ResultsData = STATIC_RESULTS): number {
  return data.confusionMatrix.matrix.reduce(
    (max, row) => row.reduce((rowMax, value) => Math.max(rowMax, value), max),
    0,
  );
}

/** Number of misclassified cells (off-diagonal sum). */
export function confusionErrors(data: ResultsData = STATIC_RESULTS): number {
  return data.confusionMatrix.matrix.reduce((total, row, rowIndex) => {
    return row.reduce((rowTotal, value, colIndex) => {
      return colIndex === rowIndex ? rowTotal : rowTotal + value;
    }, total);
  }, 0);
}

/** Total number of classified documents in the matrix. */
export function confusionTotal(data: ResultsData = STATIC_RESULTS): number {
  return data.confusionMatrix.matrix.reduce(
    (total, row) => total + row.reduce((a, b) => a + b, 0),
    0,
  );
}

/** Sums every real number in a metric column, ignoring placeholders. */
export function sumMetric(values: MetricValue[]): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    const num = toNumber(value);
    if (num !== null) {
      total += num;
      seen = true;
    }
  }
  return seen ? total : null;
}

/* Re-exported so components can type props without importing two modules. */
export type {
  ClassMetricRow,
  ConfusionMatrixData,
  DistributionSlice,
  ErrorRow,
  MetricValue,
  ModelMetricRow,
};