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
    <MemoryRouter initialEntries={['/mobile']}>
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

  // The QR is the desktop half of the download row, so it only earns its space
  // once the badge beside it is live. Both copies — hero and closing CTA.
  it('shows the QR alongside the badge now the app is released', () => {
    const { container } = renderPage();

    expect(container.querySelectorAll('img[src*="qr"]')).toHaveLength(2);
  });

  // The inverse of the pre-launch guard: with APP_STORE_URL set the badge is a
  // real link and the "coming soon" label above it is gone. Matched
  // case-insensitively — the DOM said "Coming soon" and CSS uppercased it.
  it('links the App Store badge to the listing, with no coming-soon label', () => {
    renderPage();

    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /app store/i })).toHaveLength(2);
  });

  // Region-neutral on purpose: the listing's own URL carries an /sg/ storefront
  // segment that would pin every visitor to the Singapore store. Apple 301s the
  // bare form to whichever storefront the visitor actually buys from.
  it('points the badge at a storefront-neutral App Store URL', () => {
    renderPage();

    for (const link of screen.getAllByRole('link', { name: /app store/i })) {
      expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/id6792259308');
    }
  });

  // The download row is the badge and the QR — still no secondary web CTA.
  // Registration is reachable from the nav.
  it('keeps the download row to the badge and the QR', () => {
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

  // Regression guard. Tailwind utilities are plain classes and this project sets
  // no `important`, so an inline `style={{ color }}` outranks a
  // `hover:text-…` rule in every state — which left every hover colour on this
  // page inert while looking perfectly correct in the source.
  //
  // The rule is the combination, not inline colour by itself: the snow-filled
  // Sign up button sets its own dark text inline and never changes colour on
  // hover, which is fine. Declaring a colour transition and then overriding it
  // is not.
  it('never pairs an inline colour with a hover or focus colour class', () => {
    const { container } = renderPage();

    const offenders = [...container.querySelectorAll('a')]
      .filter((a) => a.style.color !== '' && /(?:hover|focus-visible):text-/.test(a.className))
      .map((a) => `${a.getAttribute('href')} → inline ${a.style.color} beats its hover class`);

    expect(offenders, 'links whose inline colour would beat :hover / :focus-visible').toEqual([]);
  });

  // Landing's nav and CTAs all carry a focus ring; this page is the same product
  // and a keyboard user should not lose it by following the "Mobile" link.
  it('gives every header and footer link a visible focus ring', () => {
    const { container } = renderPage();

    const chrome = [
      ...(container.querySelector('header')?.querySelectorAll('a') ?? []),
      ...(container.querySelector('footer')?.querySelectorAll('a') ?? []),
    ];

    expect(chrome.length).toBeGreaterThan(0);
    for (const link of chrome) {
      const name = link.textContent || link.getAttribute('aria-label') || '';
      expect(link.className, name).toMatch(/focus-visible:ring-2/);
    }
  });

  it('titles the document for this route rather than inheriting the homepage', () => {
    renderPage();

    expect(document.title).toBe('Paypr for iPhone');
  });
});
