import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the CSRF token (set by the server as a readable cookie) to every
// mutating request. The server validates header === cookie, which an attacker
// on a different origin can't satisfy because they can't read our cookies.
api.interceptors.request.use((config) => {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='));
  const token = match?.split('=')[1];
  if (token) {
    config.headers['x-csrf-token'] = token;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
