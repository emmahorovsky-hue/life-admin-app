import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Important for httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const publicPaths = ['/login', '/register', '/verify-email'];
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
