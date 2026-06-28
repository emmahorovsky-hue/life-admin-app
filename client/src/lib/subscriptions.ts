import api from './api';

export type {
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionFormValues,
  SubscriptionCandidate,
  ExtractionResult,
} from '@life-admin/shared';
export { defaultSubscriptionFormValues, categories, billingCycles, currencies } from '@life-admin/shared';

import type {
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  ExtractionResult,
} from '@life-admin/shared';

export const subscriptionApi = {
  getAll: async (params?: {
    category?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) => {
    const response = await api.get<Subscription[]>('/subscriptions', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<Subscription>(`/subscriptions/${id}`);
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

  // Upload a receipt/invoice and get back extracted subscription candidates.
  // The shared axios instance defaults Content-Type to application/json; this
  // override is required, not cosmetic. Without it axios sees a JSON content-type
  // on a FormData body and serializes the file to JSON. Setting it to
  // multipart/form-data here makes axios pass the FormData through, and its XHR
  // adapter then resets the header so the browser adds the required boundary.
  extract: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<ExtractionResult>('/subscriptions/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
