import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api, { isPublicPath, onUnauthorized } from './api';

const originalAdapter = api.defaults.adapter;

/** Make every request from the shared instance fail with the given status. */
const failWith = (status: number) => {
  api.defaults.adapter = () =>
    Promise.reject({ response: { status, headers: {}, data: {} } });
};

const setPath = (pathname: string) => {
  window.history.pushState({}, '', pathname);
};

describe('isPublicPath', () => {
  it.each([
    '/',
    '/login',
    '/register',
    '/verify-email/success',
    '/verify-email/error',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
  ])('treats %s as public', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(['/dashboard', '/subscriptions', '/timeline', '/profile'])(
    'treats %s as protected',
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );

  it('does not over-match routes that merely share a prefix with a public route', () => {
    // The old `startsWith` matcher wrongly classified all of these as public.
    expect(isPublicPath('/registered-devices')).toBe(false);
    expect(isPublicPath('/terms-acceptance')).toBe(false);
    expect(isPublicPath('/privacy-settings')).toBe(false);
    expect(isPublicPath('/logins')).toBe(false);
    expect(isPublicPath('/reset-password-history')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isPublicPath('/login/')).toBe(true);
    expect(isPublicPath('/dashboard/')).toBe(false);
  });
});

describe('401 response interceptor', () => {
  let listener: ReturnType<typeof vi.fn>;
  let unsubscribe: () => void;

  beforeEach(() => {
    listener = vi.fn();
    unsubscribe = onUnauthorized(listener);
  });

  afterEach(() => {
    unsubscribe();
    api.defaults.adapter = originalAdapter;
    setPath('/');
  });

  it('notifies subscribers when a 401 arrives on a protected page', async () => {
    setPath('/dashboard');
    failWith(401);

    await expect(api.get('/subscriptions')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not hard-navigate away from the current page', async () => {
    setPath('/dashboard');
    failWith(401);

    await expect(api.get('/subscriptions')).rejects.toBeTruthy();
    // A full-page `window.location.href = '/login'` would blow away React state;
    // the redirect is now the router's job via ProtectedRoute.
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('stays quiet for a failed login attempt on a public page', async () => {
    setPath('/login');
    failWith(401);

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();
    expect(listener).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/login');
  });

  it('stays quiet for an anonymous auth check on the landing page', async () => {
    setPath('/');
    failWith(401);

    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores non-401 failures on protected pages', async () => {
    setPath('/dashboard');
    failWith(500);

    await expect(api.get('/subscriptions')).rejects.toBeTruthy();
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying once unsubscribed', async () => {
    setPath('/dashboard');
    failWith(401);
    unsubscribe();

    await expect(api.get('/subscriptions')).rejects.toBeTruthy();
    expect(listener).not.toHaveBeenCalled();
  });
});
