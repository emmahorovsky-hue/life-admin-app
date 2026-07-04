import axios from 'axios';
import Constants from 'expo-constants';
import { callLogout } from './authBridge';
import { tokenStorage } from './storage';

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3001/api';

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

// 401s from credential submission are expected failures (wrong password),
// not session expiry — don't clear auth state for them.
const CREDENTIAL_PATHS = ['/auth/login', '/auth/register'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const path = error.config?.url ?? '';
    if (error.response?.status === 401 && !CREDENTIAL_PATHS.includes(path)) {
      // Clear auth state — layout guard handles navigation once user becomes null
      await callLogout();
    }
    return Promise.reject(error);
  },
);
