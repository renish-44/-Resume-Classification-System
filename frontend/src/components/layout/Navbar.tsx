import { AnimatePresence, motion } from 'framer-motion';
import { Github, Menu, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GITHUB_URL, NAV_LINKS } from '@/data/site';
import { cn } from '@/lib/cn';
import { AnchorButton, LinkButton } from '@/components/ui/Button';
import { buttonStyles } from '@/components/ui/buttonStyles';
import { Logo } from '@/components/ui/Logo';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { BackendStatusChip } from './BackendStatusChip';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const { health, refresh } = useBackendHealth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Escape closes the menu; background scroll is locked while it is open.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLAnchorElement>('a, button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled ? 'glass-strong shadow-card' : 'bg-transparent',
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-4 px-5 sm:px-6 lg:px-8"
      >
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-content' : 'text-muted hover:text-content',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-xl border border-brand-400/30 bg-brand-500/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          <BackendStatusChip health={health} onRefresh={refresh} />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="ResumeForge on GitHub"
            title="View the repository"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface/70 text-muted transition-colors hover:border-brand-400/50 hover:text-content"
          >
            <Github className="h-[18px] w-[18px]" aria-hidden="true" />
          </a>
          <ThemeToggle />
          <LinkButton
            to="/demo"
            size="sm"
            iconLeft={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          >
            Try the demo
          </LinkButton>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <BackendStatusChip health={health} onRefresh={refresh} />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface/70 text-content"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            ref={panelRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line glass-strong lg:hidden"
          >
            <div className="mx-auto flex w-full max-w-content flex-col gap-1 px-5 py-5 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2">
                <BackendStatusChip health={health} onRefresh={refresh} />
                <span className="text-[11px] text-faint">{health.kind === 'mock' ? 'no backend configured' : 'GET /health'}</span>
              </div>

              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl px-4 py-3 text-base font-medium transition-colors',
                      isActive
                        ? 'border border-brand-400/30 bg-brand-500/10 text-content'
                        : 'text-muted hover:bg-elevated/70 hover:text-content',
                    )
                  }
                >
                  {link.label}
                  <span className="mt-0.5 block text-xs font-normal text-faint">
                    {link.description}
                  </span>
                </NavLink>
              ))}

              <div className="mt-3 flex flex-col gap-2.5">
                <LinkButton
                  to="/demo"
                  fullWidth
                  iconLeft={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                >
                  Try the demo
                </LinkButton>
                <AnchorButton
                  href={GITHUB_URL}
                  fullWidth
                  variant="secondary"
                  iconLeft={<Github className="h-4 w-4" aria-hidden="true" />}
                >
                  View the source
                </AnchorButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Floating back-to-top control, appears after the first scroll. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className={buttonStyles({
            variant: 'secondary',
            size: 'sm',
            className: 'fixed bottom-6 right-6 z-40 h-10 w-10 !px-0',
          })}
        >
          <span aria-hidden="true">↑</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
