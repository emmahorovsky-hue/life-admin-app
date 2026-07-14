import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { THEMES, type Theme } from '@life-admin/shared';
import { useAuth } from './AuthContext';
import { updateProfile } from '@/lib/api';

// Read by the FOUC guard in index.html before React mounts — keep in sync.
export const THEME_STORAGE_KEY = 'paypr-theme';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (THEMES as readonly string[]).includes(stored)) return stored as Theme;
  } catch {
    // Storage unavailable (private mode etc.) — fall through to the default.
  }
  return 'light';
}

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function applyThemeClass(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme runtime (LIF-186). The effective theme is derived, never duplicated:
 * the server preference wins while authenticated (covers cross-device
 * changes); the localStorage value covers logged-out sessions and the
 * pre-paint FOUC guard in index.html.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [localTheme, setLocalTheme] = useState<Theme>(readStoredTheme);

  const serverTheme =
    user && (THEMES as readonly string[]).includes(user.theme) ? (user.theme as Theme) : null;
  const theme = serverTheme ?? localTheme;

  // Sync the external systems — the <html> class, the cached copy the FOUC
  // guard reads, and (while on `system`) the OS scheme listener.
  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Best-effort cache; theme still applies for this session.
    }
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeClass('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setLocalTheme(next);
      if (!user) return;
      // Optimistic: the derived theme follows user.theme while authenticated.
      const previous = user;
      updateUser({ ...user, theme: next });
      updateProfile({ theme: next })
        .then((res) => updateUser(res.data.user))
        .catch(() => {
          updateUser(previous);
          toast.error('Failed to save your theme preference. Please try again.');
        });
    },
    [user, updateUser]
  );

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
