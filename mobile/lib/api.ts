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
