import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/dashboard';
import type { DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi } from '@/lib/subscriptions';
import { formatCurrency, formatCurrencyTotals, dominantCurrency, DEFAULT_CURRENCY } from '@/lib/currency';
import type { CurrencyAmount, CategorySpendGroup } from '@life-admin/shared';
import {
  categorySpendByCurrency,
  parseRenewalDate,
  renewalTotals,
  spendTotals,
} from '@life-admin/shared';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { PaperSheet } from '@/components/PaperSheet';
import { format, differenceInCalendarDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Aggregate figures are lists, not scalars: with no exchange-rate source, costs
// in different currencies can't be added together, so we render one line per
// currency (LIF-107). A single-currency user — the common case — sees exactly
// one line, unchanged from before.
function TotalLines({
  totals,
  fallbackCurrency,
  singleClassName,
  multiClassName,
}: {
  totals: CurrencyAmount[];
  fallbackCurrency: string;
  singleClassName: string;
  multiClassName: string;
}) {
  const lines = formatCurrencyTotals(totals, fallbackCurrency);
  return (
    <div className={lines.length > 1 ? multiClassName : singleClassName}>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}

// One category chart, in one currency. Bars from different currencies can't
// share a y-axis, so multi-currency users get one of these per currency.
function CategoryChart({ data, currency }: CategorySpendGroup) {
  const [chartWidth, setChartWidth] = useState(0);

  // Truncate x-axis labels that can't fit their bar's slot. Space Mono at
  // 11px advances ~6.6px per character; 48px covers the y-axis gutter
  // (width 44 + left margin -8 + right margin 4).
  const tickSlotChars =
    chartWidth > 0 && data.length > 0
      ? Math.max(4, Math.floor((chartWidth - 48) / data.length / 6.6))
      : Infinity;
  const formatCategoryTick = (name: string) =>
    name.length > tickSlotChars ? `${name.slice(0, tickSlotChars - 1).trimEnd()}…` : name;

  return (
    <ResponsiveContainer width="100%" height={250} onResize={(width) => setChartWidth(width)}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="2 4"
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="name"
          interval={0}
          tickFormatter={formatCategoryTick}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontFamily: 'Space Mono, monospace', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))', fontFamily: 'Space Mono, monospace', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--brand-orange) / 0.08)' }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '2px',
            fontFamily: 'Space Mono, monospace',
            fontSize: 12,
          }}
          // Without these, recharts colors the item text with the series
          // color (--accent, near-invisible on --card in both themes).
          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          itemStyle={{ color: 'hsl(var(--card-foreground))' }}
          formatter={(value: number) => [formatCurrency(value, currency), 'Monthly']}
        />
        <Bar
          dataKey="total"
          fill="hsl(var(--accent))"
          activeBar={{ fill: 'hsl(var(--brand-orange))' }}
          radius={[2, 2, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryGroups, setCategoryGroups] = useState<CategorySpendGroup[]>([]);
  // Currency the user predominantly uses — it leads every per-currency list —
  // plus a per-id lookup so each renewal can be attributed to its own
  // subscription's currency (the summary payload carries only id + cost).
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyById, setCurrencyById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [summaryData, allSubs] = await Promise.all([
          dashboardApi.getSummary(),
          subscriptionApi.getAll(),
        ]);
        setSummary(summaryData);

        const primary = dominantCurrency(allSubs.map((sub) => sub.currency));
        setDisplayCurrency(primary);
        setCurrencyById(new Map(allSubs.map((sub) => [sub.id, sub.currency])));
        setCategoryGroups(categorySpendByCurrency(allSubs, primary));
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Failed to load dashboard</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // Parse as a local calendar date (parseRenewalDate) and compare calendar
  // days, matching Subscriptions/Timeline — native Date parsing shifts the
  // day in timezones behind UTC.
  const today = new Date();
  const dueSoonRenewals = summary.upcomingRenewals.filter(
    r => differenceInCalendarDays(parseRenewalDate(r.nextRenewalDate), today) <= 7
  );

  // Every aggregate below is per-currency: renewals can be in different
  // currencies, and with no exchange-rate source a single summed figure would
  // silently add e.g. USD + EUR.
  const currencyOf = (id: string) => currencyById.get(id) ?? displayCurrency;
  const spend = spendTotals(summary, displayCurrency);
  const dueSoonTotals = renewalTotals(dueSoonRenewals, currencyOf, displayCurrency);

  const shownRenewals = summary.upcomingRenewals.slice(0, 5);
  // Total covers every upcoming renewal, not just the 5 rows shown — the
  // label calls that out below when the list is truncated.
  const upcomingTotals = renewalTotals(summary.upcomingRenewals, currencyOf, displayCurrency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">
          Welcome back, {user?.name || user?.email?.split('@')[0]}<span className="text-brand-orange">.</span>
        </h2>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Featured: monthly cost */}
        <Card style={{ backgroundColor: 'hsl(var(--brand-orange))', borderColor: 'hsl(var(--brand-orange))' }} className="text-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium opacity-75 mb-4 uppercase tracking-wide">
              Charged this month
            </p>
            <TotalLines
              totals={spend.monthly}
              fallbackCurrency={displayCurrency}
              singleClassName="text-4xl font-bold font-mono tracking-tight"
              multiClassName="text-2xl font-bold font-mono tracking-tight space-y-1"
            />
            <p className="text-sm opacity-75 mt-3">
              {summary.activeSubscriptions} active {summary.activeSubscriptions === 1 ? 'subscription' : 'subscriptions'}
            </p>
          </CardContent>
        </Card>

        {/* Annual cost */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
              Per year
            </p>
            <TotalLines
              totals={spend.annual}
              fallbackCurrency={displayCurrency}
              singleClassName="text-4xl font-bold font-mono tracking-tight"
              multiClassName="text-2xl font-bold font-mono tracking-tight space-y-1"
            />
          </CardContent>
        </Card>

        {/* Due soon */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
              Due in 7 days
            </p>
            <TotalLines
              totals={dueSoonTotals}
              fallbackCurrency={displayCurrency}
              singleClassName="text-4xl font-bold font-mono tracking-tight"
              multiClassName="text-2xl font-bold font-mono tracking-tight space-y-1"
            />
            {dueSoonRenewals.length > 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                {dueSoonRenewals.length} {dueSoonRenewals.length === 1 ? 'renewal' : 'renewals'} upcoming
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two columns: receipt table + category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming renewals — filed-paper receipt (matches Timeline / Subscriptions) */}
        <PaperSheet className="pt-6 pr-6 pb-6 pl-12">
          {summary.upcomingRenewals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No renewals in the next 30 days
              </p>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center justify-between mb-2 relative">
                  <div className="flex gap-6">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Item
                    </span>
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Renews
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {dueSoonRenewals.length > 0 && (
                      <span
                        className="text-xs font-mono uppercase tracking-widest text-brand-orange border border-brand-orange px-2 py-0.5"
                        style={{ transform: 'rotate(-4deg)', display: 'inline-block' }}
                      >
                        Due Soon
                      </span>
                    )}
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Amount
                    </span>
                  </div>
                </div>

                {/* Perforated separator */}
                <div className="border-perf mb-4" />

                {/* Renewal rows */}
                <div className="space-y-3.5">
                  {shownRenewals.map((renewal) => (
                    <div key={renewal.id} className="flex items-center gap-2">
                      <SubscriptionLogo name={renewal.name} category={renewal.category} size={28} className="shrink-0" />
                      <span className="font-mono font-bold text-sm text-foreground shrink-0">{renewal.name}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0 ml-1">
                        {format(parseRenewalDate(renewal.nextRenewalDate), 'MMM d')}
                      </span>
                      <div className="leader-dots flex-1 mx-2 mb-0.5" />
                      <span className="font-mono font-bold text-sm text-foreground shrink-0">
                        {formatCurrency(parseFloat(renewal.cost), currencyById.get(renewal.id) ?? displayCurrency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Double-line separator */}
                <div className="mt-4 mb-1 h-px bg-foreground" />
                <div className="mb-3 h-px bg-foreground" />

                {/* Total due — one line per currency, since amounts in
                    different currencies can't be added together */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Total{summary.upcomingRenewals.length > shownRenewals.length
                      ? ` · all ${summary.upcomingRenewals.length}`
                      : ''}
                  </span>
                  <TotalLines
                    totals={upcomingTotals}
                    fallbackCurrency={displayCurrency}
                    singleClassName="text-right font-mono font-bold text-foreground text-2xl"
                    multiClassName="text-right font-mono font-bold text-foreground text-xl"
                  />
                </div>

                {summary.upcomingRenewals.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate('/subscriptions')}
                  >
                    View all {summary.upcomingRenewals.length} renewals
                  </Button>
                )}
              </>
            )}
        </PaperSheet>

        {/* Category breakdown chart — one per currency, since bars in different
            currencies can't share an axis. */}
        <Card>
          <CardContent className="p-6">
            {categoryGroups.length === 0 ? (
              <>
                {/* Header — mirrors the renewals card's mono column labels */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Spending by Category
                  </span>
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Monthly
                  </span>
                </div>
                <div className="border-perf mb-4" />
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground mb-4">No subscriptions yet</p>
                  <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
                    Add Subscription
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                {categoryGroups.map((group) => (
                  <div key={group.currency}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Spending by Category
                      </span>
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        {/* Name the currency only when there's more than one chart
                            to tell apart — otherwise the header is as it always was. */}
                        Monthly{categoryGroups.length > 1 ? ` · ${group.currency}` : ''}
                      </span>
                    </div>

                    {/* Perforated separator */}
                    <div className="border-perf mb-4" />

                    <CategoryChart currency={group.currency} data={group.data} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick action */}
      {summary.activeSubscriptions === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Start tracking your subscriptions to see insights and never miss a renewal!
            </p>
            <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
              Add Your First Subscription
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
