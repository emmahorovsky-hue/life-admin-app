import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { User, AuthResponse } from '@life-admin/shared';
import { api } from '../lib/api';
import { registerLogout } from '../lib/authBridge';
import {
  invalidatePushRegistration,
  registerForPushNotifications,
  subscribeToPushTokenRotation,
} from '../lib/pushNotifications';
import { tokenStorage } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /**
   * Biometric quick-unlock is on and the token has not been unlocked yet
   * (LIF-222). Held here rather than in a gate component because
   * `restoreSession` is what reads the token: the decision to prompt has to be
   * made before the read, not after a screen has already mounted on the result.
   */
  locked: boolean;
  /** Prompts for biometrics, then restores the session. False if it did not unlock. */
  unlock: () => Promise<boolean>;
  /** Re-arms the gate on foreground; no-op when the feature is off. */
  relock: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Local-only session teardown: clears the stored token, push registration
   * and in-memory user without calling the server. For flows where the server
   * side is already dealt with — e.g. account deletion (LIF-203), where the
   * account row is gone and a /auth/logout round-trip would be pointless.
   */
  clearSession: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Why a 401 has to be told apart from a network failure: only the first means
 * the token is genuinely dead. Treating an offline launch as an invalid session
 * would sign people out for being on a train.
 */
type SessionResult = 'ok' | 'invalid' | 'transient';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  // Once user turns null the (app) layout guard redirects to login, so callers
  // never navigate themselves.
  const clearSession = useCallback(async () => {
    await tokenStorage.remove();
    invalidatePushRegistration();
    setUser(null);
    // Signing out drops the gate with the token it was guarding — leaving it up
    // would strand the user on a lock screen with nothing behind it. The
    // per-user preference in lib/biometrics.ts deliberately survives, so signing
    // back in restores the setting.
    setLocked(false);
  }, []);

  const logout = useCallback(async () => {
    // Tell the server first, while the token is still in storage for the request
    // interceptor to attach — this is what actually revokes the session
    // (LIF-174). Best-effort: if we're offline or the token has already expired
    // the call fails, and we must still clear local state rather than trap the
    // user in a logged-in app. The token is dead locally either way.
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignored on purpose — local logout must always succeed.
    }
    await clearSession();
  }, [clearSession]);

  // Register logout in the bridge so api.ts can call it on 401 without a circular import
  useEffect(() => {
    registerLogout(logout);
  }, [logout]);

  /**
   * Exchanges whatever token is available for the current user. Shared by the
   * cold-start restore and by unlock, so both handle a dead token identically.
   *
   * Only a 401 means the token is actually invalid. Network failures, timeouts
   * and 5xx are transient and must not destroy a valid persisted session (e.g.
   * opening the app while offline).
   */
  const fetchSession = useCallback(async (): Promise<SessionResult> => {
    try {
      const token = await tokenStorage.get();
      if (!token) return 'invalid';
      const { data } = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
      return 'ok';
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await tokenStorage.remove();
        return 'invalid';
      }
      return 'transient';
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        // Ask storage whether the token is gated *before* trying to read it —
        // the read is the thing that prompts. When it is, stop here and let the
        // lock screen drive: no biometric prompt fires behind the splash, and
        // no authenticated screen renders on an unlocked-looking null user.
        if (await tokenStorage.isProtected()) {
          if (isMounted) setLocked(true);
          return;
        }
        await fetchSession();
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    restoreSession();
    return () => { isMounted = false; };
  }, [fetchSession]);

  const unlock = useCallback(async (): Promise<boolean> => {
    // The prompt lives in the Keychain read itself (lib/storage.ts). A null
    // result is a cancelled, locked-out or enrolment-invalidated read — all of
    // which mean "stay locked", never "sign out".
    const token = await tokenStorage.unlock();
    if (!token) return false;

    const result = await fetchSession();

    // Biometrics succeeded but the session did not survive it — expired, or
    // revoked by a logout on another device. fetchSession has already dropped
    // the token, so clear the user too and let the layout guard route to login.
    // Unlocking the device is not the same as having a live session.
    if (result === 'invalid') {
      setUser(null);
      setLocked(false);
      return false;
    }

    // Offline or a 5xx: the token is still good, so stay locked rather than
    // bouncing to a login screen that cannot be completed either. The retry on
    // the lock screen is the better affordance, and nothing has been lost.
    if (result === 'transient') return false;

    setLocked(false);
    return true;
  }, [fetchSession]);

  const relock = useCallback(() => {
    void (async () => {
      if (!(await tokenStorage.isProtected())) return;
      // Drop the token, keep `user`. Nulling it would send the layout guard to
      // the logged-out carousel and back again on unlock — a navigation
      // round-trip the covered screen would flash through. The gate is what
      // withholds access; the token cache is what withholds the session.
      tokenStorage.lock();
      setLocked(true);
    })();
  }, []);

  // Register the device for push notifications once a session exists (login,
  // register or restore) — the endpoint needs the Bearer token, so this must
  // not run before auth. Keyed on user id so switching accounts re-registers,
  // while profile updates on the same account don't re-trigger. Registration
  // is best-effort and can never throw (see lib/pushNotifications.ts).
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    void registerForPushNotifications();
    const subscription = subscribeToPushTokenRotation();
    return () => subscription.remove();
  }, [userId]);

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
    <AuthContext.Provider
      value={{ user, loading, locked, unlock, relock, login, register, logout, clearSession, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
