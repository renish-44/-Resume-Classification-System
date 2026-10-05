import { faqs } from '@/data/content';
import { Accordion } from '@/components/ui/Accordion';
import { Container, Section } from '@/components/ui/Container';
import { LinkButton } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';

export function FaqSection() {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Questions worth answering honestly."
      description="No accuracy claims without a source. The numbers live on the Results page."
    >
      <Container size="narrow">
        <Reveal>
          <Accordion
            items={faqs.map((faq) => ({
              id: faq.id,
              question: faq.question,
              answer: faq.answer,
            }))}
          />
        </Reveal>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">Still curious about how the numbers were produced?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton to="/results" variant="secondary" size="sm">
              See the metrics
            </LinkButton>
            <LinkButton to="/about" variant="ghost" size="sm">
              Read the methodology
            </LinkButton>
          </div>
        </div>
      </Container>
    </Section>
  );
}
