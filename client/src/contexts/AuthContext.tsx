import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { onUnauthorized, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // The API client reports 401s from protected pages here rather than hard-
  // navigating to /login. Dropping the user re-renders ProtectedRoute, which
  // redirects with <Navigate> — a router navigation, so React state survives.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    setUser(response.data.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await api.post('/auth/register', { email, password, name });
    setUser(response.data.user);
  };

  const logout = async () => {
    // Tell the server first — this is what actually revokes the session
    // (LIF-174). Best-effort, same as mobile: if we're offline or the token has
    // already expired the call fails, and we must still clear local state
    // rather than trap the user in a logged-in app.
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignored on purpose — local logout must always succeed.
    }
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
