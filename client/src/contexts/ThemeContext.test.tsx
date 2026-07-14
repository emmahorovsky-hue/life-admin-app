import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('resolves system to a dark OS scheme and subscribes to changes', () => {
    stubMatchMedia(true);
    setAuth({ theme: 'system' });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // On `system`, the provider registers an OS-scheme listener so live changes apply.
    expect(matchMediaListeners.length).toBeGreaterThan(0);
  });

  it('resolves system to a light OS scheme as not-dark', () => {
    stubMatchMedia(false);
    setAuth({ theme: 'system' });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme persists to the profile and optimistically updates the user when authenticated', async () => {
    const user = userEvent.setup();
    setAuth({ theme: 'light' });
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { theme: 'dark' } },
    } as Awaited<ReturnType<typeof updateProfile>>);

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await user.click(screen.getByText('go dark'));

    // Optimistic write, then the confirmed server user.
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    await waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalledWith({ theme: 'dark' }));
  });

  it('falls back to the cached theme when logged out', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    setAuth(null);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });
});
