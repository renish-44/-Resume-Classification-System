import { motion } from 'framer-motion';
import { Check, Copy, Download, FileSearch, History, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { ApiError, HealthState, PredictResponse } from '@/lib/api';
import { usingMockBackend } from '@/lib/api';
import { lowConfidenceThreshold } from '@/data/results';
import { MODEL_LABEL, resolveLowConfidenceThreshold } from '@/data/site';
import { downloadJsonFile, fileStamp, slugify } from '@/lib/download';
import { buildResultPayload, isLowConfidence } from '@/lib/prediction';
import { formatNumber, formatPercent } from '@/lib/format';
import { scoreTone } from '@/lib/scoreTones';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Gauge } from '@/components/ui/Gauge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton, SkeletonStack } from '@/components/ui/PendingState';
import { MockModeChip } from './MockModeBanner';

const THRESHOLD = resolveLowConfidenceThreshold(lowConfidenceThreshold);

export interface Prediction {
  result: PredictResponse;
  /** ISO timestamp of when the prediction completed. */
  at: string;
}

export interface ResultPanelProps {
  status: 'idle' | 'loading' | 'error' | 'done';
  prediction: Prediction | null;
  /** Full backend error envelope, so code + request_id can be shown. */
  error: ApiError | null;
  /** True when the user cancelled the in-flight request. */
  cancelled: boolean;
  health: HealthState;
  history: Prediction[];
  onSelectHistory: (entry: Prediction) => void;
  onClearHistory: () => void;
  onDismissError: () => void;
}

/** Right-hand panel: empty state, skeleton, result card and session history. */
export function ResultPanel({
  status,
  prediction,
  error,
  cancelled,
  health,
  history,
  onSelectHistory,
  onClearHistory,
  onDismissError,
}: ResultPanelProps) {
  const { state: copyState, copy } = useCopyToClipboard();

  const payload = useMemo(() => (prediction ? buildResultPayload(prediction) : null), [prediction]);

  const jsonText = useMemo(() => (payload ? JSON.stringify(payload, null, 2) : ''), [payload]);

  const isLow = prediction !== null && isLowConfidence(prediction.result, THRESHOLD);

  const handleDownload = () => {
    if (!prediction || !payload) return;
    downloadJsonFile(
      `resumeforge-${slugify(prediction.result.predicted_category)}-${fileStamp()}.json`,
      payload,
    );
  };

  return (
    <Card className="flex h-full flex-col" aria-labelledby="result-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="result-heading" className="text-lg font-semibold">
            Prediction result
          </h2>
          <p className="mt-1 text-sm text-muted">Category, confidence and the top alternatives.</p>
        </div>
        {usingMockBackend && <MockModeChip />}
      </div>

      <div className="mt-5 flex-1">
        {/* ---- API failure ------------------------------------------------ */}
        {error && (
          <div className="mb-4 space-y-2">
            <Alert tone="error" live onDismiss={onDismissError} title={errorTitle(error)}>
              <span className="flex flex-col gap-1">
                <span>{error.message}</span>
                {error.code && (
                  <span className="font-mono text-[12px] text-muted">
                    code: {error.code}
                    {typeof error.status === 'number' ? ` · HTTP ${error.status}` : ''}
                  </span>
                )}
                {error.requestId && (
                  <span className="font-mono text-[12px] text-muted">
                    request_id: {error.requestId}
                  </span>
                )}
              </span>
            </Alert>

            {error.status === 503 && (
              <Alert tone="warn">
                The API is up but the model artifact is not loaded. Copy the trained{' '}
                <code className="font-mono text-[13px]">model.joblib</code> into{' '}
                <code className="font-mono text-[13px]">resumeforge-backend/models/</code> and restart
                the API.
              </Alert>
            )}

            {error.status === 429 && (
              <Alert tone="warn">
                The backend rate limit was hit (default 30 predictions per minute). Wait about a
                minute before trying again.
              </Alert>
            )}
          </div>
        )}

        {cancelled && (
          <Alert tone="info" className="mb-4">
            Request cancelled before the backend answered.
          </Alert>
        )}

        {health.kind === 'model-missing' && status === 'idle' && !error && (
          <Alert tone="warn" className="mb-4" title="Backend is running but no model is loaded yet">
            <span className="flex flex-col gap-1">
              <span>
                The API answered <code className="font-mono text-[13px]">/health</code> with{' '}
                <code className="font-mono text-[13px]">model_loaded: false</code>, so{' '}
                <code className="font-mono text-[13px]">/predict</code> will answer 503.
              </span>
              <span className="text-muted">
                Add the trained artifact to{' '}
                <code className="font-mono text-[13px]">resumeforge-backend/models/model.joblib</code>{' '}
                and restart the API.
              </span>
            </span>
          </Alert>
        )}

        {/* ---- Empty state ------------------------------------------------ */}
        {status === 'idle' && !prediction && !error && !cancelled && (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 text-center">
            <EmptyStateArtwork />
            <div>
              <p className="font-display text-base font-semibold">No prediction yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
                Paste text or upload a PDF/DOCX on the left, then run the prediction.
              </p>
            </div>
          </div>
        )}

        {/* ---- Loading skeleton -------------------------------------------- */}
        {status === 'loading' && (
          <div className="space-y-6" aria-hidden="true">
            <div className="flex items-center gap-5">
              <Skeleton className="h-28 w-28 shrink-0 !rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-3/4" />
                <SkeletonStack lines={2} />
              </div>
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Result ----------------------------------------------------- */}
        {prediction && status !== 'loading' && (
          <motion.div
            key={prediction.at}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-faint">
                  Predicted category
                </p>
                <p className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  {prediction.result.predicted_category}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      scoreTone(prediction.result.confidence, THRESHOLD) === 'error'
                        ? 'warn'
                        : 'success'
                    }
                  >
                    {formatPercent(prediction.result.confidence, 1)} confidence
                  </Badge>
                  {MODEL_LABEL && (
                    <Badge tone="neutral" size="sm">
                      {MODEL_LABEL}
                    </Badge>
                  )}
                </div>

                <dl className="tabular mt-4 space-y-1.5 text-xs text-faint">
                  <div className="flex gap-2">
                    <dt>Model:</dt>
                    <dd className="font-mono text-muted">{prediction.result.model}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Extracted characters:</dt>
                    <dd className="text-muted">
                      {formatNumber(prediction.result.extracted_chars)}
                    </dd>
                  </div>
                </dl>
              </div>

              <Gauge
                value={prediction.result.confidence}
                caption="confidence"
                size={168}
                label={`Confidence ${formatPercent(prediction.result.confidence, 1)}`}
                tone={scoreTone(prediction.result.confidence, THRESHOLD)}
              />
            </div>

            {isLow && (
              <Alert
                tone="warn"
                live
                title="Low confidence — this resume may overlap multiple categories."
              >
                Review this document manually, or check the alternatives below before filing it.
              </Alert>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-faint">
                  Top predictions
                </h3>
                <span className="text-xs text-faint">
                  top {prediction.result.top_predictions.length}
                </span>
              </div>

              <ul className="space-y-3.5">
                {prediction.result.top_predictions.map((item, index) => (
                  <li key={item.category}>
                    <ProgressBar
                      label={item.category}
                      valueLabel={formatPercent(item.probability, 1)}
                      value={item.probability}
                      size="md"
                      delay={index * 0.07}
                      tone={index === 0 ? 'brand' : scoreTone(item.probability, THRESHOLD)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2.5 border-t border-line pt-5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copy(jsonText)}
                iconLeft={
                  copyState === 'copied' ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )
                }
              >
                {copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'Copy result as JSON'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                iconLeft={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Download result (.json)
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ---- Prediction history ------------------------------------------- */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-content">
            <History className="h-4 w-4 text-brand-300" aria-hidden="true" />
            Recent predictions
          </h3>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              iconLeft={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Clear
            </Button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="mt-2.5 text-xs leading-relaxed text-faint">
            The last {5} predictions appear here for this session only — nothing is sent anywhere or
            stored.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((entry) => {
              const active = prediction?.at === entry.at;

              return (
                <li key={entry.at}>
                  <button
                    type="button"
                    onClick={() => onSelectHistory(entry)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-brand-400/50 bg-brand-500/10'
                        : 'border-line bg-surface/50 hover:border-brand-400/40'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {entry.result.predicted_category}
                      </span>
                      <span className="tabular block text-[11px] text-faint">
                        {new Date(entry.at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {formatPercent(entry.result.confidence, 1)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function EmptyStateArtwork() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-line bg-surface/70">
        <FileSearch className="h-9 w-9 text-brand-300" />
      </div>
    </div>
  );
}

/** Short headline for the error banner, derived from the failure kind/status. */
function errorTitle(error: ApiError): string {
  if (error.status === 503) return 'Model not loaded';
  if (error.status === 429) return 'Rate limited by the backend';
  if (error.kind === 'timeout') return 'Request timed out';
  if (error.kind === 'network') return 'Backend unreachable';
  if (error.status === 413) return 'Too large for the backend';
  if (error.status === 415) return 'Unsupported file type';
  if (error.status === 422) return 'Document could not be read';
  if (error.status === 400) return 'Invalid input';
  return 'Prediction failed';
}
