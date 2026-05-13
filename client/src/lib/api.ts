import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
      // Redirect to login if unauthorized
      if (window.location.pathname !== '/login') {
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
    details?: any;
  };
}

// API methods
export const resendVerification = async (email: string) => {
  return api.post('/auth/resend-verification', { email });
};
