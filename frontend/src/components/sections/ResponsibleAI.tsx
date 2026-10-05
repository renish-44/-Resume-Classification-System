import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { responsibleAiNotice } from '@/data/results';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';

export interface ResponsibleAIProps {
  /** Optional extra context under the official statement. */
  children?: ReactNode;
  /** Renders inside the landing page flow (with a heading) instead of the demo panel. */
  withHeading?: boolean;
}

/**
 * The exact responsible-AI statement required for the hackathon.
 * Rendered on the landing page and under the demo result panel.
 */
export function ResponsibleAI({ children, withHeading = false }: ResponsibleAIProps) {
  return (
    <div
      id={withHeading ? 'responsible-ai' : undefined}
      className="rounded-2xl border border-amber2/30 bg-amber2/[0.06] p-5 sm:p-6"
      role="note"
      aria-label="Responsible AI notice"
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber2/35 bg-amber2/10 text-amber2">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          {withHeading && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber2">
              Responsible AI
            </p>
          )}
          <p className="mt-1 text-sm font-medium leading-relaxed text-content sm:text-[15px]">
            {responsibleAiNotice}
          </p>
          {children && (
            <div className="mt-2.5 text-sm leading-relaxed text-amber2/90">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Landing-page block with its own heading. */
export function ResponsibleAISection() {
  return (
    <Container>
      <Reveal>
        <ResponsibleAI withHeading>
          Predictions organise documents; they do not evaluate people. Every classification should
          be spot-checked by a person, and low-confidence results reviewed first.
        </ResponsibleAI>
      </Reveal>
    </Container>
  );
}
