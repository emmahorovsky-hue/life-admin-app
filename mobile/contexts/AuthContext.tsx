import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
import { biometricPref, isAvailable as biometricsAvailable } from '../lib/biometrics';
import { detectTimeZone } from '../lib/locale';
import { updateProfile } from '../lib/profile';

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

/**
 * Put the token back behind the biometric gate after a sign-in, if this user had
 * quick-unlock on (LIF-222).
 *
 * Sign-out has to drop the gate flag along with the token it guards — the flag
 * is what says which Keychain item holds the live session, and a stale one
 * would strand the next launch on a lock screen with nothing behind it. So the
 * preference in lib/biometrics.ts is the only thing that survives, and without
 * this the feature would be silently off after every sign-out while the stored
 * preference still said on.
 *
 * Best-effort by design: if biometrics have been un-enrolled since, or the move
 * fails, the token stays in plain storage — which is the feature-off behaviour,
 * not a broken session. The Account screen reads the gate itself rather than the
 * preference, so the switch still shows the truth either way.
 */
async function restoreBiometricGate(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    if (!(await biometricPref.get(userId))) return;
    if (!(await biometricsAvailable())) return;
    await tokenStorage.setProtected(true);
  } catch {
    // Falls back to plain storage; the user can re-arm it from Account.
  }
}

/** How long a single unlock may last, however the app is used in between. */
const ABSOLUTE_LOCK_AFTER_MS = 12 * 60 * 60 * 1000;
/** Coarse on purpose — this is a ceiling, not a stopwatch. */
const ABSOLUTE_LOCK_CHECK_MS = 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  /** When the gate was last opened; null while locked or ungated. */
  const unlockedAt = useRef<number | null>(null);

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
    // Signing out while locked is the one case where the interceptor has no
    // token to attach, and an unauthenticated /auth/logout revokes nothing —
    // the server would have no idea whose session to end. That matters more
    // here than anywhere else: revocation is account-wide (LIF-174), and
    // "sign out" from a lock screen is what someone taps when they think the
    // phone is compromised, expecting their other sessions to die too.
    //
    // So unlock for the revoke — but never let a failed unlock trap them. An
    // enrolment change makes the item permanently unreadable, and the lock
    // screen's sign-out is the only way out of that; it has to work without
    // biometrics. A cancelled or impossible unlock just means the revoke goes
    // unsent, which is where this started.
    if (tokenStorage.isLocked()) await tokenStorage.unlock();

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
      // Having no token in hand is not the same as the server rejecting one.
      // At cold start it means signed out, and the caller does nothing either
      // way. During unlock it can only mean a concurrent relock dropped the
      // cache between the unlock and this read — and treating that as a dead
      // session would sign out a user whose token is sitting valid in the
      // Keychain. Only a real 401 is allowed to destroy anything.
      if (!token) return 'transient';
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
        // Before anything reads the token: rewrite a pre-upgrade plain copy into
        // the device-only Keychain class. Cheap, idempotent, and it has to happen
        // here because every other path either prompts or assumes a session.
        await tokenStorage.migrateAccessibility();

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

    unlockedAt.current = Date.now();
    setLocked(false);
    return true;
  }, [fetchSession]);

  const relock = useCallback(() => {
    // Synchronous on purpose. Awaiting a Keychain read here would let the app
    // finish foregrounding — and paint the user's subscriptions — before the
    // lock screen mounted. The flag is memoised in lib/storage.ts precisely so
    // this decision costs nothing; the cold-start path has always read it by
    // the time any re-lock can happen.
    if (!tokenStorage.isProtectedNow()) return;
    // Drop the token, keep `user`. Nulling it would send the layout guard to
    // the logged-out carousel and back again on unlock — a navigation
    // round-trip the covered screen would flash through. The gate is what
    // withholds access; the token cache is what withholds the session.
    tokenStorage.lock();
    unlockedAt.current = null;
    setLocked(true);
  }, []);

  /**
   * Absolute ceiling on how long one unlock stays good (LIF-222 follow-up).
   *
   * The 60s background rule in app/_layout.tsx only fires on the way back from
   * elsewhere, so an app that is never backgrounded — left open on a desk, or
   * foregrounded again every 59 seconds — stayed unlocked indefinitely. This is
   * the backstop for that: a wall-clock cap since the last successful unlock,
   * checked on a timer because no AppState event will arrive to prompt it.
   *
   * Long by design. It is not an idle timeout — it exists so an unlock cannot
   * last forever, not to interrupt someone mid-use.
   */
  useEffect(() => {
    if (locked || !user) return;

    const id = setInterval(() => {
      // Checked per tick rather than up front: switching the feature on from
      // Account does not change `locked` or `user`, so an effect that decided
      // this once would never arm the cap for the session that just enabled it.
      if (!tokenStorage.isProtectedNow()) return;
      if (unlockedAt.current === null) {
        // Gate armed while the app was already open — start its clock now.
        unlockedAt.current = Date.now();
        return;
      }
      if (Date.now() - unlockedAt.current >= ABSOLUTE_LOCK_AFTER_MS) relock();
    }, ABSOLUTE_LOCK_CHECK_MS);
    return () => clearInterval(id);
  }, [locked, user, relock]);

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

  // Keep the stored timezone in sync with the device's, silently — it decides
  // what time of day renewal reminders arrive (LIF-252). The web client has done
  // this since LIF-11 and mobile never did, which left app-only users on the
  // `"UTC"` column default: 09:00 UTC is 02:00 in California, and those are
  // exactly the users who get push.
  //
  // Re-runs when the zone changes as well as on sign-in, so travelling or moving
  // is picked up on the next launch rather than at the next web login.
  //
  // Best-effort in both directions: an unreadable zone leaves whatever the
  // server has (possibly a good one synced from web) rather than stamping UTC
  // over it, and a failed request just means reminders keep using the stored
  // zone. Neither may surface an error — the user did not ask for this.
  const userTimezone = user?.timezone;
  useEffect(() => {
    if (!userId) return;
    const detected = detectTimeZone();
    if (!detected || detected === userTimezone) return;
    updateProfile({ timezone: detected })
      .then(({ data }) => setUser(data.user))
      .catch(() => {});
  }, [userId, userTimezone]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse & { token: string }>('/auth/login', {
      email: email.toLowerCase(),
      password,
    });
    if (!data.token) throw new Error('No token in response');
    await tokenStorage.set(data.token);
    await restoreBiometricGate(data.user.id);
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
