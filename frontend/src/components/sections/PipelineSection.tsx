import { motion } from 'framer-motion';
import { pipelineSteps } from '@/data/content';
import { Container, Section } from '@/components/ui/Container';
import { IN_VIEW } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';

function StepNode({ index, active }: { index: number; active: boolean }) {
  return (
    <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-400/40 bg-app text-brand-300 shadow-glow">
      <span className="tabular font-display text-sm font-bold">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute -inset-px -z-10 rounded-2xl bg-gradient-brand opacity-0 blur-md transition-opacity duration-500',
          active && 'opacity-60',
        )}
      />
    </div>
  );
}

export function PipelineSection() {
  const isMobile = useIsMobile();

  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="One pipeline, six transparent stages."
      description="The same steps run in the notebook and in the demo, so what you see in the UI is the pipeline that produced the results."
    >
      <Container>
        <ol className={cn('relative', isMobile ? 'space-y-6' : 'grid grid-cols-6 gap-4')}>
          {!isMobile && (
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-[22px] h-px bg-gradient-brand/25"
            />
          )}

          {pipelineSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={IN_VIEW}
                transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className={cn('relative', isMobile && 'flex gap-4')}
              >
                {isMobile && (
                  <div className="flex flex-col items-center">
                    <StepNode index={index} active />
                    {index < pipelineSteps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="mt-1 h-full w-px flex-1 bg-gradient-brand/25"
                      />
                    )}
                  </div>
                )}

                {!isMobile && <StepNode index={index} active={false} />}

                <div className={cn('min-w-0', isMobile ? 'flex-1 pb-2' : 'mt-4 pr-2')}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-300 lg:hidden" aria-hidden="true" />
                    <h3 className="text-sm font-semibold leading-snug sm:text-base">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
                    {step.description}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
