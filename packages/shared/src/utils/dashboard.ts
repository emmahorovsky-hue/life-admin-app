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

// The currencies a dashboard can be scoped to, in the same dominant-first order
// every other aggregate uses (LIF-257). One entry means the account is
// single-currency and the UI shows no switcher at all — which is also what a
// server too old to send `spendByCurrency` produces, since `spendTotals` falls
// back to a single flat total in the primary currency.
//
// Derived from active spend alone, so the tabs match the figures underneath
// them: every other number on the page excludes cancelled subscriptions, and a
// tab for a currency whose subscriptions are all cancelled would open on zeros
// in every tile. Nothing becomes unreachable — renewals and the category chart
// exclude cancelled rows too, so such a currency has nothing left to show.
export function currencyOptions(spend: CurrencyAmount[], primaryCurrency: string): string[] {
  return sumByCurrency(spend, primaryCurrency).map((entry) => entry.currency);
}

// Narrow a per-currency aggregate to the one currency the dashboard is scoped
// to. Deliberately a filter and not a sum: scoping is the existing per-currency
// data with the other entries hidden, so the no-cross-currency-sum rule above
// is untouched. An empty result is the honest answer for "nothing in this
// currency" — `formatCurrencyTotals` renders it as a zero rather than a blank.
export function pickCurrency(totals: CurrencyAmount[], currency: string): CurrencyAmount[] {
  return totals.filter((total) => total.currency === currency);
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
//
// Cancelled subscriptions are excluded, matching the server's spend totals
// ("cancelled subs won't renew, so they're excluded") and therefore the tiles
// this chart sits beside. It is headed "Spending by Category", and a cancelled
// subscription is spend the user has already stopped.
export function categorySpendByCurrency(
  subscriptions: Array<
    Pick<Subscription, 'cost' | 'billingCycle' | 'category' | 'currency' | 'cancelledAt'>
  >,
  primaryCurrency: string
): CategorySpendGroup[] {
  // currency -> category -> monthly total
  const byCurrency = new Map<string, Map<string, number>>();
  for (const sub of subscriptions) {
    if (sub.cancelledAt !== null) continue;
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
