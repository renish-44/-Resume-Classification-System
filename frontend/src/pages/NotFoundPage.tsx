import { Compass } from 'lucide-react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { SITE } from '@/data/site';
import { Container } from '@/components/ui/Container';
import { LinkButton } from '@/components/ui/Button';

export default function NotFoundPage() {
  useDocumentMeta(`Page not found — ${SITE.name}`);

  return (
    <div className="flex min-h-[70vh] items-center py-20">
      <Container className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-brand-400/30 bg-brand-500/10 text-brand-300">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-6 font-mono text-sm uppercase tracking-[0.2em] text-faint">404</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">This page was not classified.</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          The link may be out of date. Head back to the overview or jump straight into the demo.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton to="/">Back to home</LinkButton>
          <LinkButton to="/demo" variant="secondary">
            Open the demo
          </LinkButton>
        </div>
      </Container>
    </div>
  );
}
