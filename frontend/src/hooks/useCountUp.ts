import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface CountUpResult<T extends HTMLElement> {
  /** Attach to the element that should trigger the animation when visible. */
  ref: RefObject<T>;
  value: number;
}

/**
 * Counts from 0 to `target` the first time the returned ref enters the
 * viewport. Respects prefers-reduced-motion by jumping straight to the value.
 * A `null` target keeps the value at 0 (used for placeholder stat tiles).
 */
export function useCountUp<T extends HTMLElement = HTMLElement>(
  target: number | null,
  durationMs = 1400,
): CountUpResult<T> {
  const ref = useRef<T>(null);
  const isInView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' });
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === null || !Number.isFinite(target)) {
      setValue(0);
      return;
    }

    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    if (!isInView) return;

    const controls = animate(0, target, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setValue(latest),
    });

    return () => controls.stop();
  }, [target, isInView, prefersReducedMotion, durationMs]);

  return { ref, value };
}
