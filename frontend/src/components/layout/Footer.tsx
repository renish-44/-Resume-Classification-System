import { Github, ShieldCheck } from 'lucide-react';
import { FOOTER_DISCLAIMER, GITHUB_URL, NAV_LINKS, SITE } from '@/data/site';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/ui/Logo';

const PIPELINE_LINKS = [
  { label: 'Pipeline stages', to: '/#how-it-works' },
  { label: 'Feature set', to: '/#features' },
  { label: 'Models compared', to: '/#models' },
  { label: 'Responsible AI', to: '/#responsible-ai' },
  { label: 'FAQ', to: '/#faq' },
];

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-surface/40">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{SITE.description}</p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-brand-400/50 hover:text-content"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              View the source
            </a>
          </div>

          <nav aria-label="Footer" className="md:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-faint">Pages</h2>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <a
                    href={link.to}
                    className="text-sm text-muted transition-colors hover:text-content"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer sections" className="md:col-span-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-faint">
              On this page
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-2.5">
              {PIPELINE_LINKS.map((link) => (
                <li key={link.to}>
                  <a
                    href={link.to}
                    className="text-sm text-muted transition-colors hover:text-content"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 rounded-2xl border border-amber2/25 bg-amber2/[0.05] p-4">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-amber2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{FOOTER_DISCLAIMER}</span>
          </p>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-faint sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} {SITE.name}. Built for {SITE.hackathon}.
          </p>
          <p className="tabular">{SITE.apiDocsHint}</p>
        </div>
      </Container>
    </footer>
  );
}
