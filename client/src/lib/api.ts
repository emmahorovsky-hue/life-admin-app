import axios from 'axios';
import type { User } from '@life-admin/shared';

export type { User, AuthResponse, ErrorResponse } from '@life-admin/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF double-submit token. The server delivers it two ways: as a (non-httpOnly)
// cookie that the browser returns automatically, and as a readable `x-csrf-token`
// response header. The web app always calls the API same-origin (Vite proxy in
// dev, Vercel rewrite to Railway in production — see vercel.json), so the cookie
// is first-party and readCsrfCookie() can see it; the cached header value is
// preferred when present and also keeps things working if VITE_API_URL ever
// points at the API cross-origin (where document.cookie can't see the API-origin
// cookie). We echo the token back on every mutating request; the server checks
// header === cookie, which an attacker on another origin can't satisfy.
let csrfToken: string | null = null;

const readCsrfCookie = (): string | null => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='));
  return match?.split('=')[1] ?? null;
};

const captureCsrfToken = (headers: Record<string, unknown> | undefined) => {
  const headerToken = headers?.['x-csrf-token'];
  if (typeof headerToken === 'string' && headerToken) {
    csrfToken = headerToken;
  }
};

api.interceptors.request.use((config) => {
  const token = csrfToken ?? readCsrfCookie();
  if (token) {
    config.headers['x-csrf-token'] = token;
  }
  return config;
});

// Response interceptor: capture the rotating CSRF token, then handle errors.
api.interceptors.response.use(
  (response) => {
    captureCsrfToken(response.headers as Record<string, unknown>);
    return response;
  },
  (error) => {
    captureCsrfToken(error.response?.headers as Record<string, unknown> | undefined);
    if (error.response?.status === 401) {
      const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/terms', '/privacy'];
      const currentPath = window.location.pathname;

      // The landing page ('/') is public; match it exactly so an anonymous
      // visitor isn't bounced to /login when the auth check 401s.
      const isLandingPage = currentPath === '/';

      // Use startsWith so that sub-paths (e.g. /verify-email/error/something)
      // are also treated as public, preventing redirect loops.
      const isPublicPath = publicPaths.some((p) => currentPath.startsWith(p));

      if (!isLandingPage && !isPublicPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const resendVerification = async (email: string) => {
  return api.post('/auth/resend-verification', { email });
};

export const forgotPassword = async (email: string) => {
  return api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, password: string) => {
  return api.post('/auth/reset-password', { token, password });
};

export const updateProfile = async (data: { name?: string; surname?: string }) => {
  return api.patch<{ user: User }>('/auth/profile', data);
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
  return api.post('/auth/change-password', data);
};

export const initiateEmailChange = async (data: { email: string }) => {
  return api.post('/auth/change-email', data);
};
