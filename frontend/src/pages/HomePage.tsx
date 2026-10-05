import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { SITE } from '@/data/site';
import { Hero } from '@/components/sections/Hero';
import { StatsStrip } from '@/components/sections/StatsStrip';
import { ProblemSection } from '@/components/sections/ProblemSection';
import { PipelineSection } from '@/components/sections/PipelineSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ModelsShowcase } from '@/components/sections/ModelsShowcase';
import { ResultsPreview } from '@/components/sections/ResultsPreview';
import { DemoTeaser } from '@/components/sections/DemoTeaser';
import { ResponsibleAISection } from '@/components/sections/ResponsibleAI';
import { FaqSection } from '@/components/sections/FaqSection';

export default function HomePage() {
  useDocumentMeta(
    `${SITE.name} — ${SITE.tagline}`,
    `${SITE.description} Built for ${SITE.hackathon}.`,
  );

  return (
    <>
      <Hero />
      <StatsStrip />
      <ProblemSection />
      <PipelineSection />
      <FeaturesSection />
      <ModelsShowcase />
      <ResultsPreview />
      <DemoTeaser />
      <ResponsibleAISection />
      <FaqSection />
    </>
  );
}
