import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@life-admin/shared';
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from './ThemeContext';
import { useAuth } from './AuthContext';
import { updateProfile } from '@/lib/api';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ updateProfile: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpdateProfile = vi.mocked(updateProfile);
const updateUser = vi.fn();

function setAuth(user: Partial<User> | null) {
  mockedUseAuth.mockReturnValue({
    user: user ? ({ id: 'u1', email: 'me@example.com', theme: 'light', ...user } as User) : null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
}

// Reads the current theme and exposes a setter button per theme.
function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>go dark</button>
      <button onClick={() => setTheme('system')}>go system</button>
    </div>
  );
}

// The provider reads the route (marketing/pre-login paths are light-only), so
// every render needs a router. Defaults to an in-app path.
function renderThemed(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

let matchMediaListeners: Array<(e: { matches: boolean }) => void>;
function stubMatchMedia(prefersDark: boolean) {
  matchMediaListeners = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
        matchMediaListeners.push(cb),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the dark class and caches when the server theme is dark', () => {
    setAuth({ theme: 'dark' });
    renderThemed();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('resolves system to a dark OS scheme and subscribes to changes', () => {
    stubMatchMedia(true);
    setAuth({ theme: 'system' });
    renderThemed();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // On `system`, the provider registers an OS-scheme listener so live changes apply.
    expect(matchMediaListeners.length).toBeGreaterThan(0);
  });

  it('resolves system to a light OS scheme as not-dark', () => {
    stubMatchMedia(false);
    setAuth({ theme: 'system' });
    renderThemed();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme persists to the profile and optimistically updates the user when authenticated', async () => {
    const user = userEvent.setup();
    setAuth({ theme: 'light' });
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { theme: 'dark' } },
    } as Awaited<ReturnType<typeof updateProfile>>);

    renderThemed();
    await user.click(screen.getByText('go dark'));

    // Optimistic write, then the confirmed server user.
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    await waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalledWith({ theme: 'dark' }));
  });

  it('falls back to the cached theme when logged out', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    setAuth(null);
    renderThemed();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });

  describe('light-only routes', () => {
    it.each(['/', '/login', '/register', '/terms', '/verify-email/success'])(
      'suppresses the dark class on %s',
      (path) => {
        setAuth({ theme: 'dark' });
        renderThemed(path);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      }
    );

    it('suppresses dark on a light-only route even when the OS prefers dark', () => {
      stubMatchMedia(true);
      setAuth({ theme: 'system' });
      renderThemed('/login');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      // No point listening for OS changes while the route can't go dark.
      expect(matchMediaListeners).toHaveLength(0);
    });

    it('keeps the preference intact so app routes pick it back up', () => {
      setAuth({ theme: 'dark' });
      const { unmount } = renderThemed('/login');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      unmount();

      renderThemed('/dashboard');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('keeps in-app /settings/privacy themed despite the public /privacy prefix', () => {
      setAuth({ theme: 'dark' });
      renderThemed('/settings/privacy');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
