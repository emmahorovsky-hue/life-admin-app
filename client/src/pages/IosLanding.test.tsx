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
    expect(screen.getByRole('heading', { name: /filed on your phone/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /never miss a renewal/i })).toBeInTheDocument();
  });

  it('gives every image a descriptive alt text', () => {
    const { container } = renderPage();

    const images = [...container.querySelectorAll('img')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.getAttribute('alt'), img.getAttribute('src') ?? '').toBeTruthy();
    }
  });

  // Scanning it today only lands you back on this page, so it is held until
  // APP_STORE_URL is set rather than shown with a "not yet" caption.
  it('does not show the QR while the app is unreleased', () => {
    const { container } = renderPage();

    expect(container.querySelector('img[src*="qr"]')).toBeNull();
  });

  // Apple's badge artwork is used unmodified, so the "coming soon" cannot be
  // printed over it — it sits above as a separate label. Matched
  // case-insensitively: the DOM says "Coming soon" and CSS uppercases it.
  it('renders the App Store badge as inert, labelled coming soon', () => {
    renderPage();

    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /app store/i })).not.toBeInTheDocument();
  });

  // Pre-launch the badge is the only thing in the download row — no QR, and no
  // secondary web CTA. Registration is reachable from the nav.
  it('leaves the App Store badge as the only item in the download row', () => {
    renderPage();

    expect(screen.queryByRole('link', { name: 'Start on the web' })).not.toBeInTheDocument();
    expect(screen.getAllByAltText('Download on the App Store')).toHaveLength(2); // hero + closing
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
