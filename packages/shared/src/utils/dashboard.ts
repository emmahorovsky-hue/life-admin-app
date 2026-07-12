import type { DashboardSummary } from '../types/dashboard';
import type { Subscription } from '../types/subscription';
import { CATEGORIES } from '../constants/subscriptions';
import { CurrencyAmount, sumByCurrency } from './currency';
import { normalizeToMonthlyCost } from './subscription';

// Dashboard aggregates, computed once here and consumed by both the web and
// mobile dashboards (they drifted apart before — LIF-107).
//
// The rule every helper below follows: there is no exchange-rate source in this
// project, so costs in different currencies are never summed into one figure.
// Each aggregate is grouped by currency and the UI renders one line per group.

// Monthly and annual spend across all active subscriptions, per currency.
export function spendTotals(
  summary: Pick<
    DashboardSummary,
    'spendByCurrency' | 'totalMonthlySpend' | 'totalAnnualSpend'
  >,
  primaryCurrency: string
): { monthly: CurrencyAmount[]; annual: CurrencyAmount[] } {
  const byCurrency = summary.spendByCurrency;

  // A server older than this client doesn't send spendByCurrency. Fall back to
  // the flat totals rendered in the primary currency — i.e. exactly the old
  // behaviour, which is correct whenever the user has a single currency.
  if (!byCurrency || byCurrency.length === 0) {
    return {
      monthly: [{ currency: primaryCurrency, amount: parseFloat(summary.totalMonthlySpend) }],
      annual: [{ currency: primaryCurrency, amount: parseFloat(summary.totalAnnualSpend) }],
    };
  }

  return {
    monthly: sumByCurrency(
      byCurrency.map((s) => ({ currency: s.currency, amount: parseFloat(s.totalMonthlySpend) })),
      primaryCurrency
    ),
    annual: sumByCurrency(
      byCurrency.map((s) => ({ currency: s.currency, amount: parseFloat(s.totalAnnualSpend) })),
      primaryCurrency
    ),
  };
}

// Total of a set of upcoming renewals, per currency. `currencyOf` resolves a
// renewal's currency (the dashboard summary payload carries only ids and costs,
// so callers look it up in the subscriptions they already fetched).
export function renewalTotals(
  renewals: Array<Pick<DashboardSummary['upcomingRenewals'][number], 'id' | 'cost'>>,
  currencyOf: (id: string) => string,
  primaryCurrency: string
): CurrencyAmount[] {
  return sumByCurrency(
    renewals.map((r) => ({ currency: currencyOf(r.id), amount: parseFloat(r.cost) })),
    primaryCurrency
  );
}

// A type alias, not an interface: victory-native's CartesianChart wants
// `Record<string, unknown>`, and only type aliases get an implicit index
// signature. An interface here fails mobile's typecheck.
export type CategorySpend = {
  name: string;
  total: number;
};

export interface CategorySpendGroup {
  currency: string;
  data: CategorySpend[];
}

// Monthly spend per category, split by currency: one chart's worth of data per
// currency. Bars from different currencies can't share an axis, so a user with
// USD and EUR subscriptions gets one chart per currency rather than a single
// chart of nonsense sums.
export function categorySpendByCurrency(
  subscriptions: Array<Pick<Subscription, 'cost' | 'billingCycle' | 'category' | 'currency'>>,
  primaryCurrency: string
): CategorySpendGroup[] {
  // currency -> category -> monthly total
  const byCurrency = new Map<string, Map<string, number>>();
  for (const sub of subscriptions) {
    const monthly = normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle);
    const categoryMap = byCurrency.get(sub.currency) ?? new Map<string, number>();
    categoryMap.set(sub.category, (categoryMap.get(sub.category) ?? 0) + monthly);
    byCurrency.set(sub.currency, categoryMap);
  }

  const groups = [...byCurrency.entries()].map(([currency, categoryMap]) => ({
    currency,
    data: [...categoryMap.entries()]
      .map(([category, total]) => ({
        name: CATEGORIES.find((c) => c.id === category)?.name ?? category,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total),
  }));

  // Same ordering rule as every other aggregate: the user's dominant currency
  // first, then by size, so the single-currency case is untouched.
  const order = sumByCurrency(
    groups.map((g) => ({
      currency: g.currency,
      amount: g.data.reduce((sum, d) => sum + d.total, 0),
    })),
    primaryCurrency
  );

  return order.map((o) => groups.find((g) => g.currency === o.currency)!);
}
