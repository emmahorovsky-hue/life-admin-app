import { api } from './api';
import type {
  Subscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
  ExtractionResult,
} from '@life-admin/shared';

// A file ready to upload — React Native's FormData takes a { uri, name, type }
// descriptor rather than a web File/Blob. Produced by lib/receiptScan.ts.
export interface UploadAsset {
  uri: string;
  name: string;
  type: string;
}

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

  // Upload a receipt/invoice (photo or document) and get back extracted
  // subscription candidates for the user to review. Mirrors the web client's
  // extract() but uses the RN FormData descriptor (see uploadAvatar in
  // lib/account.ts). The server's multer field is `file` (receiptUpload.ts).
  // The Content-Type override is required, not cosmetic: without it axios keeps
  // the instance's application/json default and serializes the descriptor to
  // JSON; RN's networking layer then rewrites the header with the multipart
  // boundary.
  extract: async (asset: UploadAsset) => {
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.type } as unknown as Blob);
    const response = await api.post<ExtractionResult>('/subscriptions/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
