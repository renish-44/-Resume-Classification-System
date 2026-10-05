import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultsData } from '@/lib/results';
import { STATIC_RESULTS } from '@/lib/results';
import { loadResults } from '@/lib/resultsApi';
import type { ResultsSource } from '@/lib/resultsApi';

export type ResultsSourceState = 'loading' | 'backend' | 'empty' | 'error';

/**
 * Data source for the Results page.
 *
 * `GET /results` is tried once on mount. When it returns `available=true` with
 * usable rows, the mapped backend data is used. In every other case
 * (available=false, empty payload, unreachable backend, mock mode) the committed
 * `src/data/results.ts` values are used instead, so the page always shows the
 * honest "Pending" states rather than anything invented.
 */
export function useResultsSource(): {
  data: ResultsData;
  note: string;
  state: ResultsSourceState;
  reload: () => void;
} {
  const [source, setSource] = useState<ResultsSource>(STATIC_RESULTS);
  const [note, setNote] = useState('Loading evaluation reports from the backend\u2026');
  const [state, setState] = useState<ResultsSourceState>('loading');
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState('loading');

    loadResults(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSource(result.source);
        setNote(result.note);
        setState(result.source.origin === 'backend' ? 'backend' : result.empty ? 'empty' : 'error');
      })
      .catch(() => {
        // Aborted or unexpected: keep the committed file values.
        if (controller.signal.aborted) return;
        setSource(STATIC_RESULTS);
        setNote('Could not load results from the backend; showing the committed values.');
        setState('error');
      });
  }, []);

  useEffect(() => {
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { data: source, note, state, reload };
}