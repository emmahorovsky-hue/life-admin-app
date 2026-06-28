export interface DashboardSummary {
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  activeSubscriptions: number;
  upcomingRenewals: Array<{
    id: string;
    name: string;
    cost: string;
    renewalDate: string;
    nextRenewalDate: string;
    daysUntilRenewal: number;
    category: string;
  }>;
}
