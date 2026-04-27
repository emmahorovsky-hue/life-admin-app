import api from './api';

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  cost: string;
  currency: string;
  billingCycle: string;
  renewalDate: string;
  category: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionData {
  name: string;
  cost: number;
  currency?: string;
  billingCycle: string;
  renewalDate: string;
  category: string;
  notes?: string;
}

export interface UpdateSubscriptionData {
  name?: string;
  cost?: number;
  currency?: string;
  billingCycle?: string;
  renewalDate?: string;
  category?: string;
  notes?: string;
}

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
};

export const categories = [
  { id: 'streaming', name: 'Streaming' },
  { id: 'fitness', name: 'Fitness' },
  { id: 'software', name: 'Software' },
  { id: 'music', name: 'Music' },
  { id: 'cloud-storage', name: 'Cloud Storage' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'news', name: 'News & Media' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'other', name: 'Other' },
];

export const billingCycles = [
  { id: 'monthly', name: 'Monthly' },
  { id: 'annual', name: 'Annual' },
  { id: 'yearly', name: 'Yearly' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'quarterly', name: 'Quarterly' },
];
