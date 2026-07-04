import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, AuthResponse } from '@life-admin/shared';
import { api } from '../lib/api';
import { registerLogout } from '../lib/authBridge';
import { tokenStorage } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await tokenStorage.remove();
    setUser(null);
  }, []);

  // Register logout in the bridge so api.ts can call it on 401 without a circular import
  useEffect(() => {
    registerLogout(logout);
  }, [logout]);

  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const token = await tokenStorage.get();
        if (token) {
          const { data } = await api.get<{ user: User }>('/auth/me');
          if (isMounted) setUser(data.user);
        }
      } catch {
        // Remove the rejected token even if unmounted — only state updates need the guard
        await tokenStorage.remove();
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    restoreSession();
    return () => { isMounted = false; };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse & { token: string }>('/auth/login', {
      email: email.toLowerCase(),
      password,
    });
    if (!data.token) throw new Error('No token in response');
    await tokenStorage.set(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse & { token: string }>('/auth/register', {
      email: email.toLowerCase(),
      password,
    });
    if (!data.token) throw new Error('No token in response');
    await tokenStorage.set(data.token);
    setUser(data.user);
  };

  const updateUser = (updatedUser: User) => setUser(updatedUser);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
