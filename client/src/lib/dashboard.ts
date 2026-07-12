import api from './api';
import type { DashboardSummary } from '@life-admin/shared';

export type { DashboardSummary };

export const dashboardApi = {
  getSummary: async () => {
    const response = await api.get<DashboardSummary>('/dashboard/summary');
    return response.data;
  },
};
