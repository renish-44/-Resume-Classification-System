import { motion } from 'framer-motion';
import { ArrowRight, Github, Sparkles } from 'lucide-react';
import { GITHUB_URL, SITE } from '@/data/site';
import { AnchorButton, LinkButton } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { fadeUp, IN_VIEW, staggerContainer } from '@/lib/motion';
import { HeroMockup } from './HeroMockup';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 sm:pb-24 sm:pt-20 lg:pb-28">
      <div aria-hidden="true" className="mesh-bg" />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <motion.div
            className="lg:col-span-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.09)}
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua-400" />
                </span>
                {SITE.hackathon}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-6 text-4xl leading-[1.08] sm:text-5xl lg:text-[3.6rem]"
            >
              Classify resumes{' '}
              <span className="relative inline-block">
                <span className="text-gradient">instantly.</span>
                <motion.span
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-[3px] rounded-full bg-gradient-brand"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>{' '}
              <br className="hidden sm:block" />
              Understand every decision.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg"
            >
              ResumeForge turns raw or extracted resume text into a predicted job category — with a
              confidence score and the runner-up categories, so an automated label never hides how
              sure the model actually is.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton
                to="/demo"
                size="lg"
                iconLeft={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                iconRight={
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                }
              >
                Try the Live Demo
              </LinkButton>

              <LinkButton to="/results" variant="secondary" size="lg">
                View Model Results
              </LinkButton>

              <AnchorButton
                href={GITHUB_URL}
                variant="outline"
                size="lg"
                aria-label="View the ResumeForge repository on GitHub"
                iconLeft={<Github className="h-5 w-5" aria-hidden="true" />}
              >
                <span className="sr-only sm:not-sr-only">GitHub</span>
              </AnchorButton>
            </motion.div>

            <motion.dl
              variants={fadeUp}
              className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-faint"
            >
              {[
                ['Input', 'PDF · DOCX · raw text'],
                ['Models', 'Classical + deep'],
                ['API', 'POST /predict'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <dt className="uppercase tracking-[0.16em]">{label}</dt>
                  <dd className="font-medium text-muted">{value}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          <motion.div
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={IN_VIEW}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <HeroMockup />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
