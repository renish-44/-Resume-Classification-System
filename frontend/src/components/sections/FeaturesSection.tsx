import { features } from '@/data/content';
import { Container, Section } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Stagger, StaggerItem } from '@/components/ui/Reveal';

export function FeaturesSection() {
  return (
    <Section
      id="features"
      eyebrow="Feature set"
      title="Built for the messy parts of real resumes."
      description="Six decisions that separate a demo that works on one file from a pipeline that survives a full dataset."
    >
      <Container>
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <StaggerItem key={feature.id} className="h-full">
                <Card interactive className="h-full">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </Section>
  );
}
