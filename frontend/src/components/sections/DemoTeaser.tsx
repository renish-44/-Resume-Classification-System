import { useState } from 'react';
import { ArrowRight, ClipboardPaste, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { lowConfidenceThreshold } from '@/data/results';
import { SAMPLE_RESUMES } from '@/data/samples';
import { resolveLowConfidenceThreshold } from '@/data/site';
import { ApiError, predict } from '@/lib/api';
import type { PredictResponse } from '@/lib/api';
import { countChars, countWords, validatePastedText } from '@/lib/validators';
import { formatPercent, formatNumber } from '@/lib/format';
import { Button, LinkButton } from '@/components/ui/Button';
import { Container, Section } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Gauge } from '@/components/ui/Gauge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { scoreTone } from '@/lib/scoreTones';
import { isLowConfidence } from '@/lib/prediction';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { MockModeChip } from '@/components/demo/MockModeBanner';

const THRESHOLD = resolveLowConfidenceThreshold(lowConfidenceThreshold);

export function DemoTeaser() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  const isLoading = status === 'loading';

  const runPrediction = async () => {
    const validation = validatePastedText(text);
    if (!validation.ok) {
      setError(validation.error ?? 'Invalid input.');
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const response = await predict({ kind: 'text', text });
      setResult(response);
      setStatus('done');
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong while contacting the prediction API.',
      );
      setStatus('error');
    }
  };

  const reset = () => {
    setText('');
    setResult(null);
    setError(null);
    setStatus('idle');
  };

  const loadSample = () => {
    const sample = SAMPLE_RESUMES[0];
    setText(sample.text);
    setResult(null);
    setError(null);
    setStatus('idle');
  };

  return (
    <Section
      id="teaser"
      eyebrow="Try it now"
      title="Paste a resume, get a category."
      description="This is a compact version of the demo. Nothing is uploaded and nothing is stored — the text is used for one prediction."
    >
      <Container>
        <Reveal>
          <Card className="mx-auto max-w-5xl">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="teaser-text"
                    className="flex items-center gap-2 text-sm font-medium text-content"
                  >
                    <ClipboardPaste className="h-4 w-4 text-brand-300" aria-hidden="true" />
                    Resume text
                  </label>
                  <span className="tabular text-xs text-faint">
                    {formatNumber(countWords(text))} words · {formatNumber(countChars(text))} chars
                  </span>
                </div>

                <textarea
                  id="teaser-text"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  rows={9}
                  spellCheck={false}
                  placeholder="Paste extracted resume text here — or load one of the built-in synthetic samples."
                  className="w-full resize-y rounded-2xl border border-line bg-app/60 p-4 font-mono text-[13px] leading-relaxed text-content placeholder:font-sans placeholder:text-faint focus:border-brand-400/70 focus:outline-none"
                />

                {error && (
                  <Alert tone="error" live className="mt-3">
                    {error}
                  </Alert>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <Button
                    onClick={runPrediction}
                    loading={isLoading}
                    iconLeft={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                  >
                    Classify
                  </Button>
                  <Button variant="secondary" onClick={loadSample}>
                    Load sample
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={reset}
                    iconLeft={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div
                aria-live="polite"
                className="flex flex-col justify-center rounded-2xl border border-line bg-elevated/40 p-5"
              >
                {isLoading && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Spinner size="lg" label="Running prediction" />
                    <p className="text-sm text-muted">Scoring categories&hellip;</p>
                  </div>
                )}

                {!isLoading && !result && (
                  <div className="py-6 text-center">
                    <p className="text-sm leading-relaxed text-muted">
                      The predicted category, its confidence score and the runner-up classes appear
                      here.
                    </p>
                  </div>
                )}

                {!isLoading && result && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-faint">
                        Predicted category
                      </p>
                      <MockModeChip />
                    </div>

                    <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                      {result.predicted_category}
                    </h3>

                    <div className="flex items-center gap-5">
                      <Gauge
                        value={result.confidence}
                        size={104}
                        strokeWidth={9}
                        tone={scoreTone(result.confidence, THRESHOLD)}
                        caption="confidence"
                      />
                      <ul className="flex-1 space-y-2.5">
                        {result.top_predictions.slice(0, 3).map((prediction, index) => (
                          <li key={prediction.category}>
                            <ProgressBar
                              value={prediction.probability}
                              label={prediction.category}
                              valueLabel={formatPercent(prediction.probability, 1)}
                              size="sm"
                              delay={index * 0.08}
                              tone={index === 0 ? 'brand' : 'neutral'}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs text-faint">
                      <Badge tone="neutral" size="sm">
                        {result.model}
                      </Badge>
                      <span className="tabular">
                        {formatNumber(result.extracted_chars)} chars extracted
                      </span>
                    </div>

                    {isLowConfidence(result, THRESHOLD) && (
                      <p className="flex items-start gap-2 text-xs text-amber2">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Low confidence — this resume may overlap multiple categories.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-xs text-faint">
                Need file uploads, top-5 breakdown and prediction history?{' '}
                <span className="text-muted">The full demo has all of it.</span>
              </p>
              <LinkButton
                to="/demo"
                variant="secondary"
                size="sm"
                iconRight={
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                }
              >
                Open full demo
              </LinkButton>
            </div>
          </Card>
        </Reveal>
      </Container>
    </Section>
  );
}
