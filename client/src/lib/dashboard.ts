import api from './api';
import type { Subscription } from '@life-admin/shared';

export type { DashboardSummary } from '@life-admin/shared';

import type { DashboardSummary } from '@life-admin/shared';

export const dashboardApi = {
  getSummary: async () => {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },

  getUpcoming: async () => {
    const response = await api.get<Subscription[]>('/dashboard/upcoming');
    return response.data;
  },
};
