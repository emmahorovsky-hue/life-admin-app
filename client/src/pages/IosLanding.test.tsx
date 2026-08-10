import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IosLanding from './IosLanding';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

type AuthState = ReturnType<typeof useAuth>;

function setAuth(state: Partial<AuthState>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...state,
  } as AuthState);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ios']}>
      <IosLanding />
    </MemoryRouter>
  );
}

describe('IosLanding', () => {
  beforeEach(() => {
    setAuth({ user: null });
  });

  it('renders the hero and the section headings', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /the pocket companion to your paper trail/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stay on top of every renewal/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /add it anywhere/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ready wherever you are/i })).toBeInTheDocument();
  });

  it('gives every screenshot a descriptive alt text', () => {
    const { container } = renderPage();

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('alt')).toBeTruthy();
    }
  });

  // The badge is announcing availability, not offering a download, until
  // APP_STORE_URL is set — a badge that looks pressable but goes nowhere is a
  // worse experience than one that plainly reads "coming soon".
  it('renders the App Store badge as inert text while the app is unreleased', () => {
    renderPage();

    expect(screen.getAllByText('COMING SOON').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('link', { name: /app store/i })
    ).not.toBeInTheDocument();
  });

  it('sends the secondary hero CTA to registration', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Start on the web' })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('offers sign-up and log-in to a signed-out visitor', () => {
    renderPage();

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(within(nav).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  // Unlike `/`, this page does not bounce signed-in users to the dashboard —
  // existing web users are the people most likely to want the app.
  it('renders for a signed-in visitor, swapping the nav CTA for the dashboard', () => {
    setAuth({ user: { id: '1', email: 'a@b.com', name: 'A' } as AuthState['user'] });
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /the pocket companion to your paper trail/i })
    ).toBeInTheDocument();

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /open paypr/i })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(within(nav).queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
  });
});
