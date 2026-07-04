import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { tokenStorage } from './storage';

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3001/api';

export const api = axios.create({
  baseURL: apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.remove();
      router.replace('/(auth)/login');
    }
    return Promise.reject(error);
  },
);
