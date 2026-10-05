/* ============================================================================
 * RESULTS DATA — SINGLE SOURCE OF TRUTH
 * ============================================================================
 * Every metric, class label, chart series and table row rendered anywhere in
 * this website comes from THIS FILE. Nothing numeric is hard-coded in a
 * component, so you only ever have to edit one place.
 *
 * HOW TO USE
 * ----------
 *  1. Replace every `PENDING` value with your real value.
 *  2. Metric values are DECIMALS between 0 and 1 (0.931 = 93.1%).
 *     `trainingTimeSec` is in seconds (or the string 'TBD').
 *  3. Add as many rows to `perClassMetrics`, `classDistribution`,
 *     `resumeLengthHistogram`, `errorRows` as your notebook produces.
 *  4. Leave a value as `PENDING` (or empty an array) and the UI renders an
 *     elegant "Pending" state instead of inventing numbers.
 *  5. Import helper `isPending` from '@/lib/results' if you add new sections.
 *
 * NEVER type a placeholder that looks like a real number. An honest blank
 * beats a convincing fake — especially in an ML write-up.
 * ========================================================================== */

/** Placeholder marker. Every un-filled value is exactly this string. */
export const PENDING = 'TBD';

/** A metric that is either a real number or still pending. */
export type MetricValue = number | typeof PENDING;

/* -------------------------------------------------------------------------
 * Guardrails / copy
 * ---------------------------------------------------------------------- */

/** Exact responsible-AI statement required for the hackathon. */
export const responsibleAiNotice =
  'This system is intended for resume classification/organization and should not be used as the sole basis for employment decisions.';

/** Editable data-handling claim. Keep it true to your deployment. */
export const dataHandlingNote =
  'In the hackathon demo, uploaded text is processed for prediction only';

/** Fallback low-confidence threshold (can be overridden with VITE_ env var). */
export const lowConfidenceThreshold = 0.5;

/* -------------------------------------------------------------------------
 * Headline stats (landing page trust strip)
 * ---------------------------------------------------------------------- */

export type StatKind = 'count' | 'percent' | 'text';

export interface HeadlineStat {
  id: string;
  label: string;
  value: MetricValue;
  /** How the value should be rendered. 'percent' expects a 0-1 decimal. */
  kind: StatKind;
  /** Plain-text fallback used when `kind === 'text'` or the value is pending. */
  text?: string;
  hint: string;
}

export const headlineStats: HeadlineStat[] = [
  {
    id: 'resumes',
    label: 'Resumes analyzed',
    value: PENDING,
    kind: 'count',
    hint: 'Rows in Resume.csv used for training and evaluation',
  },
  {
    id: 'categories',
    label: 'Distinct categories',
    value: PENDING,
    kind: 'count',
    hint: 'Unique values of the Category column',
  },
  {
    id: 'best-model',
    label: 'Best model',
    value: PENDING,
    kind: 'text',
    text: 'Select best by macro-F1',
    hint: 'Selected on macro-F1, not accuracy alone',
  },
  {
    id: 'macro-f1',
    label: 'Best macro-F1',
    value: PENDING,
    kind: 'percent',
    hint: 'Balanced score across all categories',
  },
];

/* -------------------------------------------------------------------------
 * Dataset metadata
 * ---------------------------------------------------------------------- */

export interface DatasetColumn {
  name: string;
  role: string;
  description: string;
}

export const dataset = {
  fileName: 'Resume.csv',
  rawDataRedistributed: false,
  redistributionNote:
    'The raw dataset is not redistributed in this repository. Only the derived metrics and code are published.',
  inputField: 'Resume_str',
  targetField: 'Category',
  auxiliaryFields: 'ID, Resume_html',
  totalResumes: PENDING as MetricValue,
  totalCategories: PENDING as MetricValue,
  testSplitRatio: PENDING as MetricValue,
  splittingStrategy: 'Stratified train/test split — add your ratio and random_state',
  columns: [
    {
      name: 'ID',
      role: 'Identifier',
      description: 'Row key, referenced in the error-analysis table.',
    },
    {
      name: 'Resume_str',
      role: 'Input',
      description: 'Plain-text extracted resume body used for training and inference.',
    },
    {
      name: 'Resume_html',
      role: 'Not used',
      description: 'Raw HTML source, retained in the CSV but excluded from the model.',
    },
    {
      name: 'Category',
      role: 'Target',
      description: 'Job category label the resume is classified into.',
    },
  ] satisfies DatasetColumn[],
};

/* -------------------------------------------------------------------------
 * Model comparison
 * ---------------------------------------------------------------------- */

export type ModelFamily = 'Classical ML' | 'Deep learning';

/**
 * Whether the model exists in this build.
 *
 * `shipped` — implemented, trained and loadable by resumeforge-backend.
 * `planned` — described in the project README but absent from the repository
 * (no training code, no dependency, no artifact). The UI labels these
 * "Not in this build" so the site never implies they were measured.
 */
export type ModelImplementation = 'shipped' | 'planned';

export interface ModelMetricRow {
  id: string;
  model: string;
  family: ModelFamily;
  implementation: ModelImplementation;
  description: string;
  accuracy: MetricValue;
  /** Macro-averaged precision across all categories. */
  precision: MetricValue;
  /** Macro-averaged recall across all categories. */
  recall: MetricValue;
  macroF1: MetricValue;
  weightedF1: MetricValue;
  /** Training wall-clock in seconds. */
  trainingTimeSec: MetricValue;
}

export const modelMetrics: ModelMetricRow[] = [
  {
    id: 'multinomial-nb',
    model: 'Multinomial Naive Bayes',
    family: 'Classical ML',
    implementation: 'planned',
    description: 'Fast probabilistic baseline on TF-IDF term counts. Not implemented yet.',
    accuracy: PENDING,
    precision: PENDING,
    recall: PENDING,
    macroF1: PENDING,
    weightedF1: PENDING,
    trainingTimeSec: PENDING,
  },
  {
    id: 'logistic-regression',
    model: 'TF-IDF + Logistic Regression',
    family: 'Classical ML',
    implementation: 'shipped',
    description:
      'The artifact resumeforge-backend loads: TF-IDF (1-2 grams) into a Logistic Regression classifier.',
    accuracy: PENDING,
    precision: PENDING,
    recall: PENDING,
    macroF1: PENDING,
    weightedF1: PENDING,
    trainingTimeSec: PENDING,
  },
  {
    id: 'linear-svm',
    model: 'Linear SVM',
    family: 'Classical ML',
    implementation: 'planned',
    description: 'Maximum-margin linear model. Not implemented yet.',
    accuracy: PENDING,
    precision: PENDING,
    recall: PENDING,
    macroF1: PENDING,
    weightedF1: PENDING,
    trainingTimeSec: PENDING,
  },
  {
    id: 'word2vec-bilstm',
    model: 'Word2Vec + BiLSTM',
    family: 'Deep learning',
    description: 'Static embeddings through a bidirectional LSTM classifier.',
    accuracy: PENDING,
    precision: PENDING,
    recall: PENDING,
    macroF1: PENDING,
    weightedF1: PENDING,
    trainingTimeSec: PENDING,
  },
];

/** Id of the row highlighted as "best" in the comparison table (by macro-F1). */
export const selectedModelId: string | null = null;

/* -------------------------------------------------------------------------
 * Per-class metrics
 * ---------------------------------------------------------------------- */

export interface ClassMetricRow {
  category: string;
  precision: MetricValue;
  recall: MetricValue;
  f1: MetricValue;
  support: MetricValue;
}

export const perClassMetrics: ClassMetricRow[] = [];

/* -------------------------------------------------------------------------
 * Confusion matrix
 * ---------------------------------------------------------------------- */

export interface ConfusionMatrixData {
  /** Row = true class, column = predicted class. Order must match labels. */
  labels: string[];
  matrix: number[][];
  note?: string;
}

export const confusionMatrix: ConfusionMatrixData = {
  labels: [],
  matrix: [],
};

/* -------------------------------------------------------------------------
 * Distributions
 * ---------------------------------------------------------------------- */

export interface DistributionSlice {
  label: string;
  count: MetricValue;
}

/** Resume count per Category. */
export const classDistribution: DistributionSlice[] = [];

/** Resume count per extracted-text length bucket (characters). */
export const resumeLengthHistogram: { bucket: string; count: MetricValue }[] = [];

/* -------------------------------------------------------------------------
 * Error analysis
 * ---------------------------------------------------------------------- */

export interface ErrorRow {
  id: string;
  actual: string;
  predicted: string;
  confidence: MetricValue;
  /** Short, non-sensitive excerpt of the resume text. */
  preview: string;
  suspectedCause?: string;
}

export const errorRows: ErrorRow[] = [];

export interface ErrorNote {
  title: string;
  body: string;
}

/** "Why the model errs" — edit these to match your own inspection. */
export const errorNotes: ErrorNote[] = [
  {
    title: 'Overlapping categories',
    body: 'A resume can plausibly belong to more than one category, so single-label ground truth punishes reasonable predictions.',
  },
  {
    title: 'Generic resumes',
    body: 'Boilerplate-heavy text with no role-specific vocabulary carries almost no signal for any particular category.',
  },
  {
    title: 'Very short resumes',
    body: 'Short documents have too few informative terms for a bag-of-words model to separate classes confidently.',
  },
  {
    title: 'Noisy text',
    body: 'Extraction artefacts, tracking pixels and layout fragments end up inside the text and dilute the features.',
  },
  {
    title: 'Possible mislabels',
    body: 'Some rows may be labelled inconsistently in the source data; a model can be right about the text and wrong about the label.',
  },
];

/* -------------------------------------------------------------------------
 * Evaluation setup notes
 * ---------------------------------------------------------------------- */

export interface SetupNote {
  label: string;
  value: string;
}

export const evaluationSetup: SetupNote[] = [
  {
    label: 'Split strategy',
    value: 'Stratified train/test split — add your ratio and random_state',
  },
  { label: 'Vectorizer fit', value: 'TF-IDF vocabulary fitted on the training split only' },
  { label: 'Selection metric', value: 'Macro-F1 (class-balanced) — add your final choice' },
  { label: 'Confidence source', value: 'Predict probabilities — add your calibration note' },
  { label: 'Test set usage', value: 'Held out until final evaluation' },
];
