export interface DashboardSummary {
  // Money values are decimal strings (e.g. "15.99"), never JSON numbers — the
  // server does Decimal arithmetic and serializes with 2dp (LIF-125). Parse
  // once on the client (parseFloat) for display math only.
  totalMonthlySpend: string;
  totalAnnualSpend: string;
  activeSubscriptions: number;
  upcomingRenewals: Array<{
    id: string;
    name: string;
    // Decimal string, same contract as Subscription.cost.
    cost: string;
    renewalDate: string;
    nextRenewalDate: string;
    daysUntilRenewal: number;
    category: string;
  }>;
}
