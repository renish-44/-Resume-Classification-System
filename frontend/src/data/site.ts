/* ============================================================================
 * SITE-WIDE STRINGS — brand, navigation and shared copy.
 * Replace the values you own (logo, tagline, repo URL) here.
 * ========================================================================== */

/** Public repository URL. Falls back to the Vite env var when provided. */
export const GITHUB_URL =
  import.meta.env.VITE_GITHUB_URL?.trim() ||
  'https://github.com/renish-44/-Resume-Classification-System';

export const SITE = {
  name: 'ResumeForge',
  shortName: 'RF',
  fullTitle: 'ResumeForge — Resume Classification System',
  hackathon: 'SAMATRIX RESUMEFORGE 2026',
  tagline: 'Classify resumes instantly. Understand every decision.',
  description:
    'ResumeForge turns raw or extracted resume text into a predicted job category with confidence scores and top-N alternatives.',
  apiDocsHint: 'POST /predict · multipart file or { "text": "..." }',
} as const;

export interface NavLink {
  label: string;
  to: string;
  description: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', to: '/', description: 'Overview of the system' },
  { label: 'Demo', to: '/demo', description: 'Classify a resume' },
  { label: 'Results', to: '/results', description: 'Metrics and analysis' },
  { label: 'About', to: '/about', description: 'Methodology and limits' },
];

/** Bottom-line disclaimer repeated across pages. */
export const FOOTER_DISCLAIMER =
  'For classification and organization of resumes only. Not a hiring decision tool, and never a substitute for human review.';

/* -------------------------------------------------------------------------
 * API client configuration
 * ---------------------------------------------------------------------- */

/** Empty API base URL => deterministic mock mode. Never hard-code a URL. */
export const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() ?? '';

/** True when the app runs without a backend. */
export const IS_MOCK_MODE = API_BASE_URL.length === 0;

/** Fallback low-confidence threshold if the env var is absent or invalid. */
export function resolveLowConfidenceThreshold(fallback: number): number {
  const raw = import.meta.env.VITE_LOW_CONFIDENCE_THRESHOLD;
  const parsed = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

/** Per-request timeout; falls back when the env var is absent or invalid. */
export function resolveRequestTimeoutMs(fallback: number): number {
  const parsed = Number.parseInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return fallback;
  return parsed;
}

/** Optional label shown next to the model name on the result card. */
export const MODEL_LABEL = import.meta.env.VITE_MODEL_LABEL?.trim() ?? '';

/* -------------------------------------------------------------------------
 * Validation limits — MIRRORS THE BACKEND DEFAULTS
 * ---------------------------------------------------------------------------
 * The backend is the source of truth. These values mirror
 * resumeforge-backend/src/config.py::SETTING_DEFAULTS and
 * resumeforge-backend/.env.example:
 *
 *   MAX_UPLOAD_MB    = 5        -> maxBytes
 *   MIN_TEXT_CHARS   = 50       -> minTextChars
 *   MAX_TEXT_CHARS   = 100000   -> maxTextChars
 *   SUPPORTED_UPLOAD_EXTENSIONS = ('.pdf', '.docx', '.txt') -> acceptedExtensions
 *
 * If you change the backend .env, change them here in the same commit.
 * The API also rejects 4xx responses, so client-side limits only improve the
 * error message - they never replace server-side validation.
 * ---------------------------------------------------------------------- */

export const UPLOAD_LIMITS = {
  /** MAX_UPLOAD_MB = 5 */
  maxUploadMb: 5,
  maxBytes: 5 * 1024 * 1024,
  maxBytesLabel: '5 MB',
  /** SUPPORTED_UPLOAD_EXTENSIONS = ('.pdf', '.docx', '.txt') */
  acceptedExtensions: ['.pdf', '.docx', '.txt'] as const,
  acceptedDescription: 'PDF, DOCX or TXT, up to 5 MB',
  /** MIN_TEXT_CHARS = 50 */
  minTextChars: 50,
  /** MAX_TEXT_CHARS = 100000 */
  maxTextChars: 100_000,
  minTextCharsLabel: 'at least 50 characters',
  maxTextCharsLabel: '100,000 characters',
} as const;
