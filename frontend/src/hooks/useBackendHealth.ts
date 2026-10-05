import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealth, usingMockBackend } from '@/lib/api';
import type { HealthState } from '@/lib/api';

export interface BackendHealth {
  health: HealthState;
  /** Re-probes `GET /health` (also used by the status chip). */
  refresh: () => void;
}

/**
 * Probes `GET /health` once on mount and exposes the result.
 * In mock mode (no VITE_API_URL) it short-circuits without any request.
 */
export function useBackendHealth(): BackendHealth {
  const [health, setHealth] = useState<HealthState>(() =>
    usingMockBackend ? { kind: 'mock' } : { kind: 'checking' },
  );
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (usingMockBackend) {
      setHealth({ kind: 'mock' });
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setHealth({ kind: 'checking' });

    fetchHealth(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setHealth(next);
      })
      .catch(() => {
        // Aborted: a newer probe (or unmount) already took over.
      });
  }, []);

  useEffect(() => {
    refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  return { health, refresh };
}