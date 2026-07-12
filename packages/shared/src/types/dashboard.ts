// Spend for a single currency. Costs in different currencies can't be added
// together (there is no exchange-rate source in this project), so the dashboard
// summary reports one of these per currency the user actually has.
export interface CurrencySpend {
  currency: string;
  // Decimal strings, same contract as the flat totals below.
  totalMonthlySpend: string;
  totalAnnualSpend: string;
  activeSubscriptions: number;
}

export interface DashboardSummary {
  // Money values are decimal strings (e.g. "15.99"), never JSON numbers — the
  // server does Decimal arithmetic and serializes with 2dp (LIF-125). Parse
  // once on the client (parseFloat) for display math only.
  //
  // NOTE: these two flat totals sum the raw costs of every subscription
  // regardless of currency, so they are only meaningful when the user has a
  // single currency. Prefer `spendByCurrency` (LIF-107); the flat fields are
  // kept because already-shipped mobile builds still read them.
  totalMonthlySpend: string;
  totalAnnualSpend: string;
  activeSubscriptions: number;
  // One entry per currency the user has an active subscription in, ordered by
  // subscription count (descending). Optional only because a client can be
  // newer than the server it talks to — the server always sends it.
  spendByCurrency?: CurrencySpend[];
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
