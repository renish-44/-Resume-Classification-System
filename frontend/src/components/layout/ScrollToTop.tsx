import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scrolls to the top on every route change (SPA navigation). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
