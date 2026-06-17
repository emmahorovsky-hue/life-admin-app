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

// A candidate subscription extracted from an uploaded receipt/invoice.
// Mirrors the backend SubscriptionCandidate (server/src/services/aiService.ts).
export interface SubscriptionCandidate {
  name: string;
  cost: number | null;
  currency: string | null;
  billingCycle: string;
  renewalDate: string | null; // YYYY-MM-DD
  category: string;
  notes: string | null;
  isSubscription: boolean;
  confidence: 'high' | 'medium' | 'low';
  uncertainFields: string[];
}

export interface ExtractionResult {
  candidates: SubscriptionCandidate[];
  source: 'ai' | 'none';
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

  // Upload a receipt/invoice and get back extracted subscription candidates.
  // The shared axios instance defaults Content-Type to application/json, so it
  // must be overridden here for the multipart upload.
  extract: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<ExtractionResult>('/subscriptions/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Ids must match the backend's authoritative category list (server categoryController.ts):
// streaming, fitness, software, music, cloud, gaming, productivity, other.
export const categories = [
  { id: 'streaming', name: 'Streaming' },
  { id: 'fitness', name: 'Fitness' },
  { id: 'software', name: 'Software' },
  { id: 'music', name: 'Music' },
  { id: 'cloud', name: 'Cloud Storage' },
  { id: 'gaming', name: 'Gaming' },
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
