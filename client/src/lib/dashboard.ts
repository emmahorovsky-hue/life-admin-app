import api from './api';
import { Subscription } from './subscriptions';

export interface DashboardSummary {
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  activeSubscriptions: number;
  upcomingRenewals: Array<{
    id: string;
    name: string;
    cost: string;
    renewalDate: string;
    daysUntilRenewal: number;
  }>;
}

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
