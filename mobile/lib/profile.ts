import { api } from './api';
import type { User } from '@life-admin/shared';

export const updateProfile = async (data: {
  name?: string;
  surname?: string;
  defaultCurrency?: string;
}) => {
  return api.patch<{ user: User }>('/auth/profile', data);
};

export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
  return api.post('/auth/change-password', data);
};

export const initiateEmailChange = async (data: { email: string }) => {
  return api.post('/auth/change-email', data);
};
