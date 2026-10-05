import { useCallback, useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { SITE } from '@/data/site';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { ApiError, ENDPOINTS, predict, REQUEST_TIMEOUT_MS, usingRealBackend } from '@/lib/api';
import type { PredictInput } from '@/lib/api';
import { Container } from '@/components/ui/Container';
import { InputPanel } from '@/components/demo/InputPanel';
import { ResultPanel } from '@/components/demo/ResultPanel';
import type { Prediction } from '@/components/demo/ResultPanel';
import { BackendStateBanner, MockModeBanner } from '@/components/demo/MockModeBanner';
import { ResponsibleAI } from '@/components/sections/ResponsibleAI';
import { dataHandlingNote } from '@/data/results';

const HISTORY_LIMIT = 5;

export default function DemoPage() {
  useDocumentMeta(
    `Live Demo — ${SITE.name}`,
    `Paste resume text or upload a PDF/DOCX/TXT and get a predicted job category with confidence scores. ${SITE.apiDocsHint}.`,
  );

  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { health, refresh } = useBackendHealth();

  const handleSubmit = useCallback(async (input: PredictInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);
    setCancelled(false);

    try {
      const result = await predict(input, { signal: controller.signal });
      const entry: Prediction = { result, at: new Date().toISOString() };

      setPrediction(entry);
      setHistory((current) => [entry, ...current].slice(0, HISTORY_LIMIT));
      setStatus('done');
    } catch (caught) {
      if (isAbort(caught)) {
        setCancelled(true);
        setStatus(prediction ? 'done' : 'idle');
        return;
      }

      setPrediction(null);
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError('Unexpected error while running the prediction. Please try again.', {
              kind: 'client',
            }),
      );
      setStatus('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [prediction]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setPrediction(null);
    setError(null);
    setCancelled(false);
    setStatus('idle');
  }, []);

  return (
    <div className="pb-20 pt-10 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Interactive demo
          </span>
          <h1 className="mt-5 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
            Classify a resume right now.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Paste extracted text or upload a document. The backend extracts, cleans, vectorises and
            scores every category, then returns the top predictions with confidence.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          <MockModeBanner />
          <BackendStateBanner health={health} onRefresh={refresh} />
          {usingRealBackend && health.kind === 'connected' && (
            <p className="text-center font-mono text-[11px] text-faint">
              POST {ENDPOINTS.predict()} · timeout {Math.round(REQUEST_TIMEOUT_MS / 1000)}s
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <InputPanel
            onSubmit={handleSubmit}
            onClear={handleClear}
            onCancel={handleCancel}
            loading={status === 'loading'}
          />
          <div className="flex flex-col gap-6">
            <ResultPanel
              status={status}
              prediction={prediction}
              error={error}
              cancelled={cancelled}
              health={health}
              history={history}
              onSelectHistory={setPrediction}
              onClearHistory={() => setHistory([])}
              onDismissError={() => setError(null)}
            />
            <ResponsibleAI>{dataHandlingNote}.</ResponsibleAI>
          </div>
        </div>
      </Container>
    </div>
  );
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}