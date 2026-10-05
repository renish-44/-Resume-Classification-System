import type {
  ClassMetricRow,
  ConfusionMatrixData,
  DistributionSlice,
  ErrorRow,
  MetricValue,
  ModelMetricRow,
} from '@/data/results';
import { PENDING } from '@/data/results';
import type { BackendResults, BackendResultsRow } from '@/lib/api';
import { fetchResults, usingMockBackend } from '@/lib/api';

/* ============================================================================
 * BACKEND /results  ->  FRONTEND TYPES
 * ---------------------------------------------------------------------------
 * The backend serves raw CSV rows, so every value arrives as a STRING and every
 * column name is whatever the teammate's training script wrote. This mapper is
 * therefore defensive by construction:
 *
 *   * numbers are parsed with a single tolerant converter (see `toMetric`),
 *   * a missing column becomes the PENDING placeholder instead of a fake value,
 *   * unknown columns are ignored,
 *   * several column spellings are accepted (see the alias tables below),
 *   * anything structurally broken is dropped rather than rendered.
 *
 * Accepted column names (first match wins, case/space/underscore insensitive):
 *
 *   model_results      model      | model_name | name | classifier
 *                      accuracy   | test_accuracy
 *                      precision  | macro_precision | avg_precision | precision_macro
 *                      recall     | macro_recall | avg_recall
 *                      macro f1   | macro_f1 | macrof1 | f1_macro | macro_f1_score
 *                      weighted f1| weighted_f1 | weightedf1 | f1_weighted
 *                      training   | training_time | training_time_sec | train_time
 *                                  | fit_time | training_seconds
 *
 *   per_class_metrics  category   | class | label | actual
 *                      precision  | precision_macro
 *                      recall     | recall_macro
 *                      f1         | f1_score | macro_f1 | weighted_f1
 *                      support    | support | count | samples | n
 *
 *   error_analysis     id         | index | row | sample_id        (falls back to row index)
 *                      actual     | actual_category | true | true_category | y_true | label
 *                      predicted  | predicted_category | pred | prediction | y_pred
 *                      confidence | probability | proba | score | max_probability
 *                      preview    | preview | text_preview | snippet | excerpt | text | resume_str
 *                      cause      | suspected_cause | reason | note
 * ========================================================================== */

export type ResultsOrigin = 'file' | 'backend';

export interface ResultsSource {
  origin: ResultsOrigin;
  modelMetrics: ModelMetricRow[];
  perClassMetrics: ClassMetricRow[];
  confusionMatrix: ConfusionMatrixData;
  errorRows: ErrorRow[];
  classDistribution: DistributionSlice[];
  resumeLengthHistogram: { bucket: string; count: MetricValue }[];
}

/* -------------------------------------------------------------------------
 * Column lookup + value coercion
 * ---------------------------------------------------------------------- */

const ALIASES = {
  model: ['model', 'model_name', 'name', 'classifier'],
  accuracy: ['accuracy', 'test_accuracy'],
  precision: ['precision', 'macro_precision', 'avg_precision', 'precision_macro'],
  recall: ['recall', 'macro_recall', 'avg_recall', 'recall_macro'],
  macroF1: ['macro_f1', 'macrof1', 'f1_macro', 'macro_f1_score'],
  weightedF1: ['weighted_f1', 'weightedf1', 'f1_weighted', 'weighted_f1_score'],
  trainingTime: [
    'training_time',
    'training_time_sec',
    'training_time_seconds',
    'training_seconds',
    'train_time',
    'fit_time',
  ],
  category: ['category', 'class', 'label', 'actual'],
  f1: ['f1', 'f1_score', 'score', 'macro_f1', 'weighted_f1'],
  support: ['support', 'count', 'samples', 'n', 'num_samples'],
  id: ['id', 'index', 'row', 'sample_id', 'resume_id'],
  actual: ['actual', 'actual_category', 'true', 'true_category', 'y_true', 'label'],
  predicted: ['predicted', 'predicted_category', 'pred', 'prediction', 'y_pred'],
  confidence: ['confidence', 'probability', 'proba', 'score', 'max_probability'],
  preview: ['preview', 'text_preview', 'snippet', 'excerpt', 'text', 'resume_str'],
  cause: ['suspected_cause', 'cause', 'reason', 'note'],
} as const;

type AliasKey = keyof typeof ALIASES;

const normaliseKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s\-.]+/g, '_');

/** First non-empty cell matching any accepted alias for `key`. */
export function pick(row: BackendResultsRow, key: AliasKey): string | undefined {
  const wanted = ALIASES[key] as readonly string[];
  const entries = Object.entries(row);

  for (const alias of wanted) {
    for (const [rawKey, rawValue] of entries) {
      if (normaliseKey(rawKey) !== alias) continue;
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (value === undefined || value === null || value === '') continue;
      return String(value);
    }
  }

  return undefined;
}

/**
 * Converts a CSV cell into a `MetricValue`.
 *
 * Accepts numbers and numeric strings in [0, 1] and percentages such as
 * "93.1%". Anything else (empty, "n/a", "TBD", NaN) becomes PENDING — the UI
 * then renders a dash instead of a fabricated metric.
 */
export function toMetric(value: string | number | undefined): MetricValue {
  if (value === undefined || value === null) return PENDING;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : PENDING;
  }

  const raw = String(value).trim();
  if (raw === '' || /^n\/?a$/i.test(raw) || raw.toLowerCase() === 'tbd' || raw === '-') return PENDING;

  const isPercent = raw.endsWith('%');
  const numeric = Number.parseFloat(isPercent ? raw.slice(0, -1) : raw);

  if (!Number.isFinite(numeric)) return PENDING;

  const normalised = isPercent ? numeric / 100 : numeric;
  if (normalised < 0 || normalised > 1) return PENDING;

  return normalised;
}

/** Non-negative integers (support, training seconds) or PENDING. */
function toCount(value: string | number | undefined): MetricValue {
  const metric = toMetric(value);
  if (typeof metric === 'number') return metric;

  const numeric = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return PENDING;
  return numeric;
}

function slug(value: string, fallback: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

/* -------------------------------------------------------------------------
 * Row mapping
 * ---------------------------------------------------------------------- */

function mapModelRow(row: BackendResultsRow, index: number): ModelMetricRow | null {
  const model = pick(row, 'model');
  if (!model) return null;

  return {
    id: slug(model, `model-${index + 1}`),
    model,
    family: 'Classical ML',
    description: 'Reported by the backend evaluation reports.',
    accuracy: toMetric(pick(row, 'accuracy')),
    precision: toMetric(pick(row, 'precision')),
    recall: toMetric(pick(row, 'recall')),
    macroF1: toMetric(pick(row, 'macroF1')),
    weightedF1: toMetric(pick(row, 'weightedF1')),
    trainingTimeSec: toCount(pick(row, 'trainingTime')),
  };
}

function mapPerClassRow(row: BackendResultsRow): ClassMetricRow | null {
  const category = pick(row, 'category');
  if (!category) return null;

  return {
    category,
    precision: toMetric(pick(row, 'precision')),
    recall: toMetric(pick(row, 'recall')),
    f1: toMetric(pick(row, 'f1')),
    support: toCount(pick(row, 'support')),
  };
}

function mapErrorRow(row: BackendResultsRow, index: number): ErrorRow | null {
  const actual = pick(row, 'actual');
  const predicted = pick(row, 'predicted');
  if (!actual && !predicted) return null;

  const cause = pick(row, 'cause');

  return {
    id: pick(row, 'id') ?? String(index + 1),
    actual: actual ?? 'unknown',
    predicted: predicted ?? 'unknown',
    confidence: toMetric(pick(row, 'confidence')),
    preview: pick(row, 'preview') ?? '',
    ...(cause ? { suspectedCause: cause } : {}),
  };
}

/** Confusion matrix: rows must be numeric, labels must match the row count. */
export function mapConfusionMatrix(
  payload: BackendResults['confusion_matrix'],
): ConfusionMatrixData {
  if (!payload || payload.matrix.length === 0) {
    return { labels: [], matrix: [] };
  }

  const labels =
    payload.labels.length === payload.matrix.length
      ? payload.labels
      : payload.matrix.map((_, index) => `class ${index + 1}`);

  return { labels, matrix: payload.matrix, note: 'Loaded from the backend /results endpoint.' };
}

/** Maps a whole `/results` payload into the frontend structures. */
export function mapBackendResults(payload: BackendResults): ResultsSource {
  return {
    origin: 'backend',
    modelMetrics: payload.model_results
      .map(mapModelRow)
      .filter((row): row is ModelMetricRow => row !== null),
    perClassMetrics: payload.per_class_metrics
      .map(mapPerClassRow)
      .filter((row): row is ClassMetricRow => row !== null),
    confusionMatrix: mapConfusionMatrix(payload.confusion_matrix),
    errorRows: payload.error_analysis
      .map(mapErrorRow)
      .filter((row): row is ErrorRow => row !== null),
    // The backend exposes no class-distribution or length-histogram endpoint,
    // so these stay empty and the UI keeps its honest "Pending" state.
    classDistribution: [],
    resumeLengthHistogram: [],
  };
}

/** Source used when the backend has nothing to report (or was unreachable). */
export function fallbackSource(): ResultsSource {
  return {
    origin: 'file',
    modelMetrics: [],
    perClassMetrics: [],
    confusionMatrix: { labels: [], matrix: [] },
    errorRows: [],
    classDistribution: [],
    resumeLengthHistogram: [],
  };
}

/* -------------------------------------------------------------------------
 * Fetch
 * ---------------------------------------------------------------------- */

export interface ResultsFetchResult {
  source: ResultsSource;
  /** Human-readable note shown above the tables. */
  note: string;
  /** True when the backend answered but had nothing to show. */
  empty: boolean;
}

/**
 * `GET /results` -> frontend data, with a graceful fallback.
 * `available=false`, an empty payload, or any failure returns the honest empty
 * source so the page renders its "Pending" states instead of fake numbers.
 */
export async function loadResults(signal?: AbortSignal): Promise<ResultsFetchResult> {
  if (usingMockBackend) {
    return { ...fallbackResult('No backend configured (demo mode).'), source: fallbackSource() };
  }

  try {
    const payload = await fetchResults(signal);

    if (!payload.available) {
      return {
        ...fallbackResult('The backend reports no evaluation reports yet (available=false).'),
        source: fallbackSource(),
      };
    }

    const source = mapBackendResults(payload);
    const hasAnything =
      source.modelMetrics.length > 0 ||
      source.perClassMetrics.length > 0 ||
      source.errorRows.length > 0 ||
      source.confusionMatrix.matrix.length > 0;

    if (!hasAnything) {
      return {
        ...fallbackResult('The backend reported available=true but every report row was unusable.'),
        source: fallbackSource(),
      };
    }

    return {
      source,
      note: 'Loaded live from the backend (GET /results).',
      empty: false,
    };
  } catch (error) {
    return {
      ...fallbackResult(
        error instanceof Error
          ? `Could not reach the backend results endpoint: ${error.message}`
          : 'Could not reach the backend results endpoint.',
      ),
      source: fallbackSource(),
    };
  }
}

function fallbackResult(note: string): ResultsFetchResult {
  return { source: fallbackSource(), note, empty: true };
}