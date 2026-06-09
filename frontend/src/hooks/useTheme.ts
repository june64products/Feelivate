import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'feelivate-theme';

/**
 * useTheme — auto-detects system preference (prefers-color-scheme),
 * allows manual override via localStorage, and sets `data-theme` on <html>.
 */
export function useTheme() {
  const getSystemTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return getSystemTheme();
  };

  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply theme to <html> element
  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  // Set theme + persist
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  }, [applyTheme]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Reset to system preference
  const resetToSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const sys = getSystemTheme();
    setThemeState(sys);
    applyTheme(sys);
  }, [applyTheme]);

  // Apply on mount + listen for system preference changes
  useEffect(() => {
    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually overridden
      if (!localStorage.getItem(STORAGE_KEY)) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [applyTheme, theme]);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
    resetToSystem,
  };
}
