import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF double-submit token. The server delivers it two ways: as a (non-httpOnly)
// cookie that the browser returns automatically, and as a readable `x-csrf-token`
// response header. We rely on the header because in production the SPA (Vercel)
// and API (Railway) are different origins, so document.cookie can't see the
// API-origin cookie. We cache the latest header value and echo it back on every
// mutating request; the server checks header === cookie, which an attacker on
// another origin can't satisfy. The cookie fallback keeps same-origin dev working.
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
      const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
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

// Type definitions
export interface User {
  id: string;
  email: string;
  name: string | null;
  surname: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

// API methods
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
