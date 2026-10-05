import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { BackToTop, Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollToTop } from './ScrollToTop';

/** Route-level fallback shown while a lazy page chunk downloads. */
export function PageLoader() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand-300" aria-hidden="true" />
      <p className="text-sm text-muted">Loading page&hellip;</p>
    </div>
  );
}

export interface LayoutProps {
  children: ReactNode;
}

/** App shell: skip link, sticky nav, routed content, footer, floating controls. */
export function Layout({ children }: LayoutProps) {
  return (
    <div className="grain relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:border focus:border-brand-400/50 focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-content"
      >
        Skip to content
      </a>

      <ScrollToTop />
      <Navbar />

      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
