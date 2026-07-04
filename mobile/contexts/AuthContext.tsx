import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthResponse } from '@life-admin/shared';
import { api } from '../lib/api';
import { tokenStorage } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await tokenStorage.get();
        if (token) {
          const { data } = await api.get<{ user: User }>('/auth/me');
          setUser(data.user);
        }
      } catch {
        await tokenStorage.remove();
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse & { token: string }>('/auth/login', {
      email: email.toLowerCase(),
      password,
    });
    await tokenStorage.set(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const { data } = await api.post<AuthResponse & { token: string }>('/auth/register', {
      email: email.toLowerCase(),
      password,
      name,
    });
    await tokenStorage.set(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await tokenStorage.remove();
    setUser(null);
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
