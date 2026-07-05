import { api } from './api';
import type {
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from '@life-admin/shared';

export const subscriptionApi = {
  getAll: async (params?: { category?: string; sort?: string; order?: 'asc' | 'desc' }) => {
    const response = await api.get<Subscription[]>('/subscriptions', { params });
    return response.data;
  },

  create: async (data: CreateSubscriptionData) => {
    const response = await api.post<Subscription>('/subscriptions', data);
    return response.data;
  },

  update: async (id: string, data: UpdateSubscriptionData) => {
    const response = await api.patch<Subscription>(`/subscriptions/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/subscriptions/${id}`);
  },

  // Stop the subscription renewing; it stays active until its period end.
  cancel: async (id: string) => {
    const response = await api.post<Subscription>(`/subscriptions/${id}/cancel`);
    return response.data;
  },

  // Reverse a pending cancellation so the subscription renews again.
  resume: async (id: string) => {
    const response = await api.post<Subscription>(`/subscriptions/${id}/resume`);
    return response.data;
  },
};
