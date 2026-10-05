import { API_BASE_URL, IS_MOCK_MODE, resolveRequestTimeoutMs } from '@/data/site';

/* ============================================================================
 * API CLIENT — ResumeForge FastAPI backend
 * ---------------------------------------------------------------------------
 * Endpoints used (all defined in resumeforge-backend/api/routes.py):
 *   GET  /health      -> { status, model_loaded, model_name, version }
 *   GET  /results     -> { available, model_results, per_class_metrics,
 *                          confusion_matrix, error_analysis }
 *   POST /predict     -> multipart field "file"  OR  application/json {"text": "..."}
 *
 * POST /predict success body:
 *   {
 *     "predicted_category": string,
 *     "confidence": number,                                   // 0 - 1
 *     "top_predictions": [{ "category": string, "probability": number }],
 *     "model": string,
 *     "extracted_chars": number,
 *     "low_confidence": boolean
 *   }
 *
 * Every failure uses one envelope (resumeforge-backend/api/errors.py):
 *   { "error": string, "code": SNAKE_CASE, "request_id": string }
 * plus the X-Request-ID response header, which the backend exposes to the
 * browser through Access-Control-Expose-Headers.
 *
 * No URL is ever hard-coded: set VITE_API_URL. When it is empty the client
 * falls back to a deterministic MOCK response that the UI always labels as
 * simulated output.
 * ========================================================================== */

/** Keys the backend guarantees on a successful /predict response. */
export const PREDICT_RESPONSE_KEYS = [
  'predicted_category',
  'confidence',
  'top_predictions',
  'model',
  'extracted_chars',
  'low_confidence',
] as const;

/** Keys the backend guarantees on every error response. */
export const ERROR_ENVELOPE_KEYS = ['error', 'code', 'request_id'] as const;

/** Field name of the multipart upload part expected by the backend. */
export const UPLOAD_FIELD_NAME = 'file';

/** Default per-request timeout when VITE_REQUEST_TIMEOUT_MS is unset/invalid. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export const REQUEST_TIMEOUT_MS = resolveRequestTimeoutMs(DEFAULT_REQUEST_TIMEOUT_MS);

export interface TopPrediction {
  category: string;
  /** 0 - 1 */
  probability: number;
}

export interface PredictResponse {
  predicted_category: string;
  confidence: number;
  top_predictions: TopPrediction[];
  model: string;
  extracted_chars: number;
  /**
   * Server-side flag. When the backend provides it we trust it; otherwise the
   * UI falls back to its own threshold.
   */
  low_confidence?: boolean;
}

/** The full backend envelope, as far as the UI needs it. */
export interface ApiErrorEnvelope {
  error?: string;
  code?: string;
  request_id?: string;
}

/** Why a request failed — decides whether a retry is allowed. */
export type ApiFailureKind = 'http' | 'network' | 'timeout' | 'client';

export interface ApiErrorDetails {
  status?: number;
  code?: string;
  requestId?: string;
  kind?: ApiFailureKind;
  /** Raw message sent by the backend, kept for the details line. */
  detail?: string;
}

/** Error type carrying everything the UI needs to explain a failure. */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly kind: ApiFailureKind;
  readonly detail?: string;

  constructor(message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.kind = details.kind ?? 'http';
    this.detail = details.detail;
  }

  /** True for failures where one more attempt could succeed. */
  get isNetworkFailure(): boolean {
    return this.kind === 'network';
  }
}

/** True when the app runs against the deterministic mock backend. */
export const usingMockBackend = IS_MOCK_MODE;

/** True when a real backend URL is configured. */
export const usingRealBackend = !IS_MOCK_MODE;

export const API_BASE = API_BASE_URL;

/** Absolute endpoint helper. Throws in mock mode so it is never used offline. */
export function endpoint(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/** Endpoints used by the app (useful for the status chip and the docs). */
export const ENDPOINTS = {
  health: () => endpoint('/health'),
  results: () => endpoint('/results'),
  predict: () => endpoint('/predict'),
} as const;

/* -------------------------------------------------------------------------
 * Health
 * ---------------------------------------------------------------------- */

export interface HealthPayload {
  status: string;
  model_loaded: boolean;
  model_name: string | null;
  version: string | null;
}

export type HealthState =
  /** Frontend runs without a backend (VITE_API_URL empty). */
  | { kind: 'mock' }
  /** Probe in flight. */
  | { kind: 'checking' }
  /** Backend reachable and a model is loaded. */
  | { kind: 'connected'; modelName: string | null; version: string | null }
  /** Backend reachable but the artifact failed to load. */
  | { kind: 'model-missing'; version: string | null }
  /** Backend could not be reached at all. */
  | { kind: 'unreachable'; detail: string };

/** `GET /health`, normalised into a discriminated union the UI can render. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthState> {
  if (IS_MOCK_MODE) return { kind: 'mock' };

  try {
    const response = await requestWithTimeout(ENDPOINTS.health(), { method: 'GET' }, signal, 8_000);
    const payload = (await response.json()) as Partial<HealthPayload>;
    const version = typeof payload.version === 'string' ? payload.version : null;

    if (payload.model_loaded === true) {
      return {
        kind: 'connected',
        modelName: typeof payload.model_name === 'string' ? payload.model_name : null,
        version,
      };
    }

    return { kind: 'model-missing', version };
  } catch (error) {
    if (isAbort(error)) throw error;
    return {
      kind: 'unreachable',
      detail:
        error instanceof ApiError
          ? error.message
          : 'The prediction API could not be reached.',
    };
  }
}

/* -------------------------------------------------------------------------
 * Results
 * ---------------------------------------------------------------------- */

export type BackendResultsRow = Record<string, string>;

export interface BackendConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface BackendResults {
  available: boolean;
  model_results: BackendResultsRow[];
  per_class_metrics: BackendResultsRow[];
  confusion_matrix: BackendConfusionMatrix | null;
  error_analysis: BackendResultsRow[];
}

export const EMPTY_BACKEND_RESULTS: BackendResults = {
  available: false,
  model_results: [],
  per_class_metrics: [],
  confusion_matrix: null,
  error_analysis: [],
};

/** `GET /results`. Defensive: an unusable payload becomes `available: false`. */
export async function fetchResults(signal?: AbortSignal): Promise<BackendResults> {
  if (IS_MOCK_MODE) return EMPTY_BACKEND_RESULTS;

  const response = await requestWithTimeout(ENDPOINTS.results(), { method: 'GET' }, signal, 15_000);
  const payload = (await response.json()) as Partial<BackendResults>;

  return {
    available: payload.available === true,
    model_results: asRowArray(payload.model_results),
    per_class_metrics: asRowArray(payload.per_class_metrics),
    confusion_matrix: parseConfusionMatrix(payload.confusion_matrix),
    error_analysis: asRowArray(payload.error_analysis),
  };
}

function asRowArray(value: unknown): BackendResultsRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is BackendResultsRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row),
  );
}

/** Validates `confusion_matrix`; anything inconsistent becomes `null`. */
export function parseConfusionMatrix(value: unknown): BackendConfusionMatrix | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const { labels, matrix } = value as { labels?: unknown; matrix?: unknown };
  if (!Array.isArray(matrix) || matrix.length === 0) return null;

  const rows: number[][] = [];
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length === 0) return null;
    const numbers: number[] = [];
    for (const cell of row) {
      const num = typeof cell === 'number' ? cell : Number(cell);
      if (!Number.isFinite(num)) return null;
      numbers.push(num);
    }
    rows.push(numbers);
  }

  const safeLabels = Array.isArray(labels)
    ? labels.filter((label): label is string => typeof label === 'string')
    : [];

  // A label/matrix size mismatch would silently mislabel the heatmap: drop it.
  if (safeLabels.length > 0 && safeLabels.length !== rows.length) return null;

  return { labels: safeLabels, matrix: rows };
}

/* -------------------------------------------------------------------------
 * Predict
 * ---------------------------------------------------------------------- */

/** Everything the demo panel can submit. */
export type PredictInput =
  | { kind: 'text'; text: string }
  | { kind: 'file'; file: File; extension: '.pdf' | '.docx' | '.txt' };

export interface PredictOptions {
  /** Number of ranked categories to request (backend accepts 1-10). */
  topK?: number;
  signal?: AbortSignal;
}

/**
 * Sends a prediction request.
 * Retries **once** on a network failure only — never on 4xx/5xx.
 */
export async function predict(
  input: PredictInput,
  options: PredictOptions = {},
): Promise<PredictResponse> {
  if (IS_MOCK_MODE) return mockPredict(input);

  const url = options.topK ? `${ENDPOINTS.predict()}?top_k=${options.topK}` : ENDPOINTS.predict();
  const attempts = 2;
  let lastNetworkError: ApiError | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await postPredict(url, input, options.signal);
    } catch (error) {
      if (isAbort(error)) throw error;
      if (error instanceof ApiError && error.isNetworkFailure && attempt < attempts) {
        lastNetworkError = error;
        await delay(250 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastNetworkError ?? new ApiError('The prediction request failed.');
}

async function postPredict(
  url: string,
  input: PredictInput,
  signal?: AbortSignal,
): Promise<PredictResponse> {
  let body: FormData | string;
  let headers: Record<string, string> | undefined;

  if (input.kind === 'file') {
    // Never set Content-Type manually: the browser must add the boundary.
    const form = new FormData();
    form.append(UPLOAD_FIELD_NAME, input.file, input.file.name);
    body = form;
  } else {
    body = JSON.stringify({ text: input.text });
    headers = { 'Content-Type': 'application/json' };
  }

  const response = await requestWithTimeout(url, { method: 'POST', body, headers }, signal);
  const payload = await readJson(response);

  if (!response.ok) {
    throw apiErrorFromPayload(response, payload);
  }

  return parsePredictResponse(payload);
}

function readJson(response: Response): unknown {
  return response.json().catch(() => undefined);
}

/** Builds an ApiError from the backend envelope. */
export function apiErrorFromPayload(response: Response, payload: unknown): ApiError {
  const envelope = extractEnvelope(payload);
  const status = response.status;
  const headerRequestId = response.headers.get('x-request-id') ?? undefined;

  return new ApiError(friendlyErrorMessage(status, envelope.code, envelope.error), {
    status,
    code: envelope.code,
    requestId: envelope.request_id ?? headerRequestId,
    kind: 'http',
    detail: envelope.error,
  });
}

function extractEnvelope(payload: unknown): ApiErrorEnvelope {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as Record<string, unknown>;
  return {
    error: typeof data.error === 'string' ? data.error : undefined,
    code: typeof data.code === 'string' ? data.code : undefined,
    request_id: typeof data.request_id === 'string' ? data.request_id : undefined,
  };
}

/** Code-specific hints, keyed by the backend's SNAKE_CASE codes. */
const CODE_HINTS: Record<string, string> = {
  EMPTY_TEXT: 'The resume text was empty. Paste the extracted text and try again.',
  INPUT_TOO_SHORT: 'The resume text is too short to classify reliably.',
  MISSING_INPUT: 'No resume was submitted. Paste text, or upload a PDF/DOCX/TXT file.',
  AMBIGUOUS_INPUT: 'Send either a file or text, not both.',
  MULTIPLE_FILES: 'Only one file can be classified per request.',
  INVALID_JSON: 'The request body was not valid JSON.',
  EMPTY_FILE: 'The uploaded file is empty.',
  FILE_TOO_LARGE: 'The file is larger than the upload limit accepted by the backend.',
  INPUT_TOO_LONG: 'The resume text is longer than the backend accepts.',
  BATCH_TOO_LARGE: 'Too many items in one request.',
  UNSUPPORTED_FILE_TYPE: 'That file type is not supported. Use PDF, DOCX or TXT.',
  UNSUPPORTED_CONTENT_TYPE: 'The request content type is not supported by the backend.',
  CORRUPTED_FILE: 'That document could not be parsed — it may be corrupted.',
  ENCRYPTED_PDF: 'That PDF is password protected. Remove the password or paste the text instead.',
  NO_EXTRACTABLE_TEXT: 'No text could be extracted from that document (scanned or image-only?).',
  VALIDATION_ERROR: 'The request failed validation.',
  RATE_LIMIT_EXCEEDED: 'Rate limit reached. Wait about a minute before retrying.',
  MODEL_NOT_LOADED: 'Backend is running but no model is loaded yet.',
  MODEL_NOT_FOUND: 'Backend is running but no model artifact was found.',
  MODEL_LOAD_ERROR: 'Backend is running but the model artifact could not be loaded.',
  INTERNAL_SERVER_ERROR: 'The backend hit an internal error. Check its logs for details.',
};

/** Status-level fallbacks used when the code is unknown. */
const STATUS_HINTS: Record<number, string> = {
  400: 'The backend rejected the request as invalid.',
  413: 'The upload or text exceeds the backend limit.',
  415: 'The backend does not accept that content type.',
  422: 'The request could not be processed by the backend.',
  429: 'Rate limit reached. Wait about a minute before retrying.',
  500: 'The backend hit an internal error. Check its logs for details.',
  503: 'Backend is running but no model is loaded yet.',
};

/**
 * Builds the message shown to the user.
 * Prefers the backend's own (user-safe) message, prefixed with a short hint when
 * the code is one we can explain better.
 */
export function friendlyErrorMessage(
  status?: number,
  code?: string,
  backendMessage?: string,
): string {
  const hint = code ? CODE_HINTS[code] : undefined;
  const fallback = status ? STATUS_HINTS[status] : undefined;
  const base = hint ?? fallback ?? backendMessage;

  if (!base) return 'The prediction request failed for an unknown reason.';

  // When a code-specific hint exists, keep the backend detail as the tail so no
  // useful information is lost.
  if (hint && backendMessage && backendMessage !== hint) return `${hint} (${backendMessage})`;
  return base;
}

/** Validates and normalises an untrusted /predict success body. */
export function parsePredictResponse(payload: unknown): PredictResponse {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('The API returned an unexpected response shape.', { kind: 'client' });
  }

  const data = payload as Record<string, unknown>;
  const category = data.predicted_category;

  if (typeof category !== 'string' || category.trim() === '') {
    throw new ApiError('The API response did not include a predicted category.', { kind: 'client' });
  }

  const confidence = clampProbability(data.confidence);
  const top = Array.isArray(data.top_predictions) ? data.top_predictions : [];

  const topPredictions: TopPrediction[] = top
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      category: typeof item.category === 'string' ? item.category : 'Unknown',
      probability: clampProbability(item.probability),
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10);

  return {
    predicted_category: category,
    confidence,
    top_predictions: topPredictions.length
      ? topPredictions
      : [{ category, probability: confidence }],
    model: typeof data.model === 'string' && data.model ? data.model : 'Unknown model',
    extracted_chars:
      typeof data.extracted_chars === 'number' ? Math.max(0, data.extracted_chars) : 0,
    low_confidence: typeof data.low_confidence === 'boolean' ? data.low_confidence : undefined,
  };
}

function clampProbability(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

/* -------------------------------------------------------------------------
 * fetch plumbing: timeout, cancellation, network-only retry
 * ---------------------------------------------------------------------- */

interface RequestInitLike {
  method: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

/**
 * `fetch` + hard timeout, while still honouring an external abort signal.
 * A timeout produces an ApiError(kind='timeout'); an external abort re-throws the
 * original AbortError so callers can treat it as a user cancellation.
 */
async function requestWithTimeout(
  url: string,
  init: RequestInitLike,
  signal?: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    return await fetch(url, {
      method: init.method,
      body: init.body ?? null,
      headers: init.headers,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (signal?.aborted) throw error; // user cancellation — caller decides
    if (timedOut) {
      throw new ApiError(
        `The backend did not answer within ${Math.round(timeoutMs / 1000)}s. It may be busy or unreachable.`,
        { kind: 'timeout' },
      );
    }
    throw new ApiError(
      'Could not reach the prediction API. Check that the backend is running and that VITE_API_URL points to it.',
      { kind: 'network' },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* -------------------------------------------------------------------------
 * Deterministic mock backend (used only when VITE_API_URL is empty)
 * ---------------------------------------------------------------------- */

/**
 * Category pool for MOCK mode only. It exists so the UI has something to render
 * offline; it is NOT a claim about the real model's label set.
 */
const MOCK_CATEGORY_POOL = [
  'Data Science',
  'Engineering',
  'Human Resources',
  'Accounting',
  'Healthcare',
  'Information Technology',
  'Sales',
  'Marketing',
] as const;

export const MOCK_MODEL_LABEL = 'Mock model (demo mode)';

/** FNV-1a — stable across runs and browsers, unlike `Math.random()`. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Seeded PRNG so the same input always produces the same simulated output. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function mockPredict(input: PredictInput): Promise<PredictResponse> {
  // Simulated latency so the loading state is visible and testable.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const text = input.kind === 'text' ? input.text : input.file.name;
  const random = mulberry32(hashString(text.trim().toLowerCase()));

  const pool = [...MOCK_CATEGORY_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const leaders = pool.slice(0, 5);
  const confidence = Number((0.52 + random() * 0.44).toFixed(4));

  // The runner-up classes share the remaining probability mass, so the response
  // is a valid distribution that sums to 1.
  const restWeights = leaders.slice(1).map(() => 0.15 + random() * 0.85);
  const restTotal = restWeights.reduce((sum, value) => sum + value, 0) || 1;
  const restMass = 1 - confidence;

  const topPredictions: TopPrediction[] = [
    { category: leaders[0], probability: confidence },
    ...leaders.slice(1).map((category, index) => ({
      category,
      probability: Number(((restWeights[index] / restTotal) * restMass).toFixed(4)),
    })),
  ].sort((a, b) => b.probability - a.probability);

  topPredictions[0].probability = confidence;

  return {
    predicted_category: topPredictions[0].category,
    confidence,
    top_predictions: topPredictions,
    model: MOCK_MODEL_LABEL,
    extracted_chars: input.kind === 'text' ? input.text.trim().length : 0,
    low_confidence: confidence < 0.5,
  };
}