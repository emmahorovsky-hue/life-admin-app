import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailError from './VerifyEmailError';
import VerifyEmailSuccess from './VerifyEmailSuccess';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ resendVerification: vi.fn() }));

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

const loggedIn = { user: { id: '1', email: 'a@b.com' } as AuthState['user'], loading: false };
const loggedOut = { user: null, loading: false };

function renderError(reason: string) {
  return render(
    <MemoryRouter initialEntries={[`/verify-email/error?reason=${reason}`]}>
      <VerifyEmailError />
    </MemoryRouter>,
  );
}

function renderSuccess() {
  return render(
    <MemoryRouter>
      <VerifyEmailSuccess />
    </MemoryRouter>,
  );
}

// People almost always open verification links from an email in a browser where
// they are not logged in, so the logged-out cases are the common ones.
describe('VerifyEmailError (LIF-138)', () => {
  beforeEach(() => mockedUseAuth.mockReset());

  it('offers a login link instead of hiding resend when logged out', () => {
    setAuth(loggedOut);
    renderError('expired');

    expect(screen.getByRole('link', { name: 'Log in to resend' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
  });

  it('never points a logged-out visitor at the dashboard', () => {
    setAuth(loggedOut);
    renderError('expired');

    const dashboardLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/dashboard');
    expect(dashboardLinks).toHaveLength(0);
  });

  it('keeps the resend button for logged-in users', () => {
    setAuth(loggedIn);
    renderError('expired');

    expect(screen.getByRole('button', { name: 'Resend verification' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('sends an already-verified visitor to login when logged out', () => {
    setAuth(loggedOut);
    renderError('already_used');

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('sends an already-verified visitor to the dashboard when logged in', () => {
    setAuth(loggedIn);
    renderError('already_used');

    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('renders no CTA while the auth check is still in flight', () => {
    setAuth({ loading: true });
    renderError('expired');

    expect(screen.getByText('Link expired')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('VerifyEmailSuccess (LIF-138)', () => {
  beforeEach(() => mockedUseAuth.mockReset());

  it('routes the CTA to login when logged out', () => {
    setAuth(loggedOut);
    renderSuccess();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('routes the CTA to the dashboard when logged in', () => {
    setAuth(loggedIn);
    renderSuccess();

    expect(screen.getByRole('link', { name: 'Continue to app' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('renders no CTA while the auth check is still in flight', () => {
    setAuth({ loading: true });
    renderSuccess();

    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
