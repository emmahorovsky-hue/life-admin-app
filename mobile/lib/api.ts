import axios from 'axios';
import Constants from 'expo-constants';
import { callLogout } from './authBridge';
import { tokenStorage } from './storage';

// The localhost fallback is dev-only (LIF-131): a release build that shipped
// without API_URL would otherwise silently point every user at localhost.
// Failing at startup makes the misconfiguration impossible to miss.
const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  (__DEV__ ? 'http://localhost:3001/api' : undefined);

if (!apiUrl) {
  throw new Error(
    'No API URL was configured for this build. Set API_URL in mobile/eas.json ' +
      'for the build profile (or as an EAS environment variable) and rebuild.',
  );
}

// For the rare consumer that needs a raw URL instead of the axios instance —
// e.g. an <Image source> pointing at an authenticated endpoint (lib/account.ts).
export const apiBaseUrl: string = apiUrl;

export const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': 'mobile',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  // Locked, not signed out (LIF-222): the token is behind the biometric gate
  // and has not been unlocked in this process. Letting the call go out bare
  // would earn a 401, and the interceptor below reads every 401 as a dead
  // session — so one stray request while locked would sign the user out of a
  // perfectly good session. A locked app has no session to spend; fail here
  // and let the lock screen resolve it.
  //
  // Not exempting /auth/logout: sign-out from the lock screen unlocks first
  // precisely so the revoke can be authenticated, and if that unlock failed
  // there is nothing worth sending anyway.
  //
  // A CanceledError rather than a plain throw, so `axios.isCancel` marks it as
  // "we withdrew this", not "the server said no".
  if (tokenStorage.isLocked()) {
    throw new axios.CanceledError('Paypr is locked');
  }

  return config;
});

// 401s from credential submission are expected failures (wrong password), not
// session expiry — don't clear auth state for them. /auth/logout is exempt for a
// different reason: logout() itself calls it, so clearing auth state here would
// re-enter logout() and re-issue the request forever. The server answers 200
// even for a dead token (LIF-174), but this guard must not rely on that.
const NO_SESSION_CLEAR_PATHS = ['/auth/login', '/auth/register', '/auth/logout'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const path = error.config?.url ?? '';
    if (error.response?.status === 401 && !NO_SESSION_CLEAR_PATHS.includes(path)) {
      // Clear auth state — layout guard handles navigation once user becomes null
      await callLogout();
    }
    return Promise.reject(error);
  },
);
