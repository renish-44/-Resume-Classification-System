import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'error';

/** Copies text to the clipboard and resets to `idle` after a moment. */
export function useCopyToClipboard(resetAfterMs = 2000): {
  state: CopyState;
  copy: (value: string) => Promise<boolean>;
} {
  const [state, setState] = useState<CopyState>('idle');
  const timeout = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  const copy = useCallback(
    async (value: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          throw new Error('Clipboard API unavailable');
        }
        setState('copied');
        return true;
      } catch {
        setState('error');
        return false;
      } finally {
        window.clearTimeout(timeout.current);
        timeout.current = window.setTimeout(() => setState('idle'), resetAfterMs);
      }
    },
    [resetAfterMs],
  );

  return { state, copy };
}
