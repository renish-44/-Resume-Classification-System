import { useContext } from 'react';
import type { ThemeContextValue } from '@/lib/theme';
import { ThemeContext } from '@/lib/theme';

/**
 * Reads and mutates the theme.
 * Must be used inside <ThemeProvider> (see components/layout/ThemeProvider).
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }

  return context;
}

/** Current theme only. */
export function useThemeValue(): ThemeContextValue['theme'] {
  return useTheme().theme;
}
