import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';

/**
 * Decorative product mockup for the hero.
 *
 * IMPORTANT: this is a purely visual, looping illustration. It shows no metric
 * values and no claimed model output — real numbers only ever come from the
 * API response or from src/data/results.ts.
 */

type Phase = 'idle' | 'reading' | 'thinking' | 'done';

const PHASES: Phase[] = ['idle', 'reading', 'thinking', 'done'];
const STEP_MS = 1500;

const DOC_LINES = [92, 78, 88, 64, 84, 72, 58, 80];

export function HeroMockup() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % PHASES.length);
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  const phase = prefersReducedMotion ? 'done' : PHASES[step];

  return (
    <div
      aria-hidden="true"
      className="relative w-full"
      /* purely decorative: hidden from assistive tech */
    >
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-brand opacity-20 blur-3xl" />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="gradient-ring relative overflow-hidden rounded-3xl border border-line bg-surface/80 p-5 shadow-lift backdrop-blur-xl sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose2/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber2/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
            <Sparkles className="h-3 w-3" />
            Illustrative preview
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.15fr]">
          {/* Resume document ------------------------------------------------ */}
          <div className="relative rounded-2xl border border-line bg-app/60 p-4">
            <AnimatePresence mode="wait">
              {phase === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center"
                >
                  <FileText className="h-6 w-6 text-brand-300" />
                  <p className="text-xs text-muted">Drop a resume to begin</p>
                </motion.div>
              )}

              {phase !== 'idle' && (
                <motion.div
                  key="doc"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-brand-300" />
                    <span className="h-2 w-24 rounded-full bg-muted/40" />
                  </div>
                  {DOC_LINES.map((width, index) => (
                    <motion.span
                      key={index}
                      className="block h-1.5 rounded-full bg-muted/25"
                      style={{ width: `${width}%` }}
                      animate={
                        phase === 'reading'
                          ? { backgroundColor: 'rgb(var(--c-ring) / 0.55)' }
                          : { backgroundColor: 'rgb(var(--c-muted) / 0.25)' }
                      }
                      transition={{
                        duration: 0.45,
                        delay: prefersReducedMotion ? 0 : index * 0.07,
                        repeat: phase === 'reading' && !prefersReducedMotion ? Infinity : 0,
                        repeatDelay: 0.1,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-elevated">
              <motion.div
                className="h-full rounded-full bg-gradient-brand"
                animate={{
                  width:
                    phase === 'idle'
                      ? '0%'
                      : phase === 'reading'
                        ? '46%'
                        : phase === 'thinking'
                          ? '78%'
                          : '100%',
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Prediction panel --------------------------------------------- */}
          <div className="rounded-2xl border border-line bg-elevated/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              Predicted category
            </p>

            <div className="mt-2 h-9">
              <AnimatePresence mode="wait">
                {phase === 'done' ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-500/15 px-3.5 py-1.5 text-sm font-semibold text-brand-200"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Category returned
                  </motion.div>
                ) : (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-faint"
                  >
                    {phase === 'thinking' ? (
                      <>
                        <motion.span
                          className="h-3 w-3 rounded-full border-2 border-brand-300/40 border-t-brand-300"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        Scoring categories
                      </>
                    ) : (
                      'Waiting for input'
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { label: 'confidence', delay: 0 },
                { label: 'alternative 1', delay: 0.12 },
                { label: 'alternative 2', delay: 0.22 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
                      {row.label}
                    </span>
                    <span className="h-1.5 w-8 rounded-full bg-muted/25" />
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                    <motion.div
                      className="h-full rounded-full bg-gradient-brand"
                      initial={{ width: '0%' }}
                      animate={{
                        width:
                          phase === 'done'
                            ? row.delay === 0
                              ? '78%'
                              : row.delay === 0.12
                                ? '46%'
                                : '27%'
                            : '0%',
                      }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: row.delay }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating accent chips -------------------------------------------- */}
      <motion.div
        className="absolute -left-3 bottom-8 hidden rounded-2xl border border-line bg-surface/90 px-3 py-2 text-[11px] font-medium text-muted shadow-lift backdrop-blur sm:block"
        animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        TF-IDF &rarr; softmax
      </motion.div>

      <motion.div
        className="absolute -right-3 top-24 hidden rounded-2xl border border-line bg-surface/90 px-3 py-2 text-[11px] font-medium text-muted shadow-lift backdrop-blur sm:block"
        animate={prefersReducedMotion ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
      >
        top-5 classes
      </motion.div>
    </div>
  );
}
