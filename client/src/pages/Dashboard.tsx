import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/dashboard';
import type { DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi } from '@/lib/subscriptions';
import { formatCurrency, formatCurrencyTotals, dominantCurrency, DEFAULT_CURRENCY } from '@/lib/currency';
import type { CurrencyAmount, CategorySpendGroup } from '@life-admin/shared';
import {
  categorySpendByCurrency,
  currencyOptions,
  parseRenewalDate,
  pickCurrency,
  renewalTotals,
  spendTotals,
} from '@life-admin/shared';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { CurrencySwitcher } from '@/components/CurrencySwitcher';
import { PaperSheet } from '@/components/PaperSheet';
import { EmptyState } from '@/components/EmptyState';
import { FirstRunWizard } from '@/components/onboarding/FirstRunWizard';
import { ResumeSetupCard } from '@/components/onboarding/ResumeSetupCard';
import {
  readOnboardingState,
  writeOnboardingState,
  shouldShowWizard,
  shouldShowResumeCard,
  type OnboardingState,
} from '@/lib/onboarding';
import { readDashboardCurrency, writeDashboardCurrency } from '@/lib/dashboardCurrency';
import { format, differenceInCalendarDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Aggregate figures are lists, not scalars: with no exchange-rate source, costs
// in different currencies can't be added together (LIF-107). Since LIF-257 the
// page is scoped to one currency, so every list handed to this is already
// narrowed to a single entry — but it stays a list, because that is what makes
// the sums impossible rather than merely absent. An empty list is "nothing in
// this currency" and renders as a zero, not a blank.
function TotalLines({
  totals,
  fallbackCurrency,
  className,
}: {
  totals: CurrencyAmount[];
  fallbackCurrency: string;
  className: string;
}) {
  return (
    <div className={className}>
      {formatCurrencyTotals(totals, fallbackCurrency).map((line) => (
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
          formatter={(value) => [formatCurrency(Number(value ?? 0), currency), 'Monthly']}
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

interface DashboardData {
  summary: DashboardSummary;
  displayCurrency: string;
  currencyById: Map<string, string>;
  categoryGroups: CategorySpendGroup[];
  /**
   * Whether the account holds any subscription at all — the onboarding gate.
   * Deliberately the row count rather than `summary.activeSubscriptions`, which
   * excludes cancelled and ended rows: someone who cancelled everything still
   * has a file, and must not be re-offered the first-run wizard.
   */
  hasSubscriptions: boolean;
}

// Fetching is kept out of the component so the initial load and the post-
// onboarding refetch share one implementation without either of them setting
// state from inside an effect body.
async function fetchDashboardData(): Promise<DashboardData> {
  const [summary, allSubs] = await Promise.all([
    dashboardApi.getSummary(),
    subscriptionApi.getAll(),
  ]);
  const displayCurrency = dominantCurrency(allSubs.map((sub) => sub.currency));
  return {
    summary,
    displayCurrency,
    currencyById: new Map(allSubs.map((sub) => [sub.id, sub.currency])),
    categoryGroups: categorySpendByCurrency(allSubs, displayCurrency),
    hasSubscriptions: allSubs.length > 0,
  };
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
  // The currency the whole page is scoped to (LIF-257). Null until the user
  // picks one — the *effective* currency is derived below rather than stored,
  // so a remembered choice the account no longer holds (or one that arrives
  // before the data does) falls back to the dominant currency on its own,
  // without an effect that could fight a refetch.
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(() =>
    readDashboardCurrency(user?.id)
  );
  // First-run onboarding (LIF-220). Keyed by account, not by browser — see the
  // note in lib/onboarding.ts (LIF-242). Read once on mount is enough: reaching
  // a different user means a logout, and that unmounts this page.
  const [onboarding, setOnboarding] = useState<OnboardingState>(() =>
    readOnboardingState(user?.id)
  );
  // Whether the wizard is open is derived, not stored, so it can't drift from
  // the persisted status. These two flags are the only user-driven overrides:
  // `wizardClosed` after an explicit dismiss, and `filedThisSession` to hold the
  // final "Filed" step on screen after filing flips the status to `done` and the
  // account stops being empty — which would otherwise close it mid-step.
  const [wizardClosed, setWizardClosed] = useState(false);
  const [filedThisSession, setFiledThisSession] = useState(false);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);

  const applyDashboard = useCallback((data: DashboardData) => {
    setSummary(data.summary);
    setDisplayCurrency(data.displayCurrency);
    setCurrencyById(data.currencyById);
    setCategoryGroups(data.categoryGroups);
    setHasSubscriptions(data.hasSubscriptions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((data) => {
        if (!cancelled) applyDashboard(data);
      })
      .catch((err) => console.error('Failed to load dashboard:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyDashboard]);

  const refetchDashboard = useCallback(async () => {
    try {
      applyDashboard(await fetchDashboardData());
    } catch (err) {
      console.error('Failed to reload dashboard:', err);
    }
  }, [applyDashboard]);

  const selectCurrency = useCallback(
    (currency: string) => {
      setSelectedCurrency(currency);
      writeDashboardCurrency(user?.id, currency);
    },
    [user?.id]
  );

  const updateOnboarding = useCallback(
    (next: OnboardingState) => {
      setOnboarding(next);
      writeOnboardingState(user?.id, next);
    },
    [user?.id]
  );

  const wizardOpen =
    !wizardClosed &&
    (filedThisSession || (!loading && !!summary && shouldShowWizard(onboarding, hasSubscriptions)));

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

  // Every aggregate is still per-currency — with no exchange-rate source a
  // single summed figure would silently add e.g. USD + EUR. What changed in
  // LIF-257 is that the page shows one of those currencies at a time instead of
  // every line at once: the figures below are the same per-currency data,
  // narrowed to `currency`, never combined.
  const currencyOf = (id: string) => currencyById.get(id) ?? displayCurrency;
  const spend = spendTotals(summary, displayCurrency);

  // Tabs come from spend plus any currency that only has cancelled rows left:
  // it still owns renewals and a chart, so it needs a way to be reached.
  const currencies = currencyOptions(spend.monthly, currencyById.values(), displayCurrency);
  const showSwitcher = currencies.length > 1;
  // A single-currency account can't have a stale selection to honour, so it
  // reads exactly as it did before the switcher existed.
  const currency =
    selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : displayCurrency;

  // Active-subscription count for the currency on screen. Falls back to the
  // flat count only when the server is too old to send `spendByCurrency` —
  // which is also the case where the account reads as single-currency anyway.
  const activeInCurrency = summary.spendByCurrency
    ? (summary.spendByCurrency.find((s) => s.currency === currency)?.activeSubscriptions ?? 0)
    : summary.activeSubscriptions;

  // Parse as a local calendar date (parseRenewalDate) and compare calendar
  // days, matching Subscriptions/Timeline — native Date parsing shifts the
  // day in timezones behind UTC.
  const today = new Date();
  const renewals = summary.upcomingRenewals.filter((r) => currencyOf(r.id) === currency);
  const dueSoonRenewals = renewals.filter(
    r => differenceInCalendarDays(parseRenewalDate(r.nextRenewalDate), today) <= 7
  );
  const dueSoonTotals = renewalTotals(dueSoonRenewals, currencyOf, currency);

  const shownRenewals = renewals.slice(0, 5);
  // Total covers every upcoming renewal in this currency, not just the 5 rows
  // shown — the label calls that out below when the list is truncated.
  const upcomingTotals = renewalTotals(renewals, currencyOf, currency);

  // One chart, for the currency on screen. Absent only on an empty account:
  // every currency with a subscription has a group, and the tabs are built
  // from those same subscriptions.
  const categoryGroup = categoryGroups.find((g) => g.currency === currency);

  return (
    <div className="space-y-6">
      {shouldShowResumeCard(onboarding, hasSubscriptions) && (
        <ResumeSetupCard
          step={onboarding.step}
          onResume={() => {
            updateOnboarding({ ...onboarding, status: 'pending' });
            setWizardClosed(false);
          }}
        />
      )}

      <div>
        <h2 className="text-3xl font-bold">
          Welcome back, {user?.name || user?.email?.split('@')[0]}<span className="text-brand-orange">.</span>
        </h2>
      </div>

      {/* Currency switcher — only for accounts that actually hold more than one */}
      {showSwitcher && (
        <CurrencySwitcher currencies={currencies} value={currency} onChange={selectCurrency} />
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Featured: monthly cost */}
        <Card style={{ backgroundColor: 'hsl(var(--brand-orange))', borderColor: 'hsl(var(--brand-orange))' }} className="text-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium opacity-75 mb-4 uppercase tracking-wide">
              Charged this month
            </p>
            <TotalLines
              totals={pickCurrency(spend.monthly, currency)}
              fallbackCurrency={currency}
              className="text-4xl font-bold font-mono tracking-tight"
            />
            <p className="text-sm opacity-75 mt-3">
              {activeInCurrency} active {activeInCurrency === 1 ? 'subscription' : 'subscriptions'}
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
              totals={pickCurrency(spend.annual, currency)}
              fallbackCurrency={currency}
              className="text-4xl font-bold font-mono tracking-tight"
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
              fallbackCurrency={currency}
              className="text-4xl font-bold font-mono tracking-tight"
            />
            <p className="text-sm text-muted-foreground mt-3">
              {dueSoonRenewals.length > 0
                ? `${dueSoonRenewals.length} ${dueSoonRenewals.length === 1 ? 'renewal' : 'renewals'} upcoming`
                : 'Nothing due this week'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two columns: receipt table + category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming renewals — filed-paper receipt (matches Timeline / Subscriptions) */}
        <PaperSheet className="pt-6 pr-6 pb-6 pl-12">
          {renewals.length === 0 ? (
              <EmptyState
                tone="inline"
                icon={null}
                title={
                  // With a switcher on screen the list is scoped, so "in the
                  // next 30 days" would read as though the account were empty.
                  showSwitcher
                    ? `No ${currency} renewals in the next 30 days`
                    : 'No renewals in the next 30 days'
                }
              />
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
                        {formatCurrency(parseFloat(renewal.cost), currencyOf(renewal.id))}
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
                    Total{renewals.length > shownRenewals.length
                      ? ` · all ${renewals.length}`
                      : ''}
                  </span>
                  <TotalLines
                    totals={upcomingTotals}
                    fallbackCurrency={currency}
                    className="text-right font-mono font-bold text-foreground text-2xl"
                  />
                </div>

                {renewals.length > shownRenewals.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate('/subscriptions')}
                  >
                    View all {renewals.length} renewals
                  </Button>
                )}
              </>
            )}
        </PaperSheet>

        {/* Category breakdown chart — one currency's worth, since bars in
            different currencies can't share an axis. The switcher above chooses
            which; the header needs no currency suffix because only one is on
            screen at a time. */}
        <Card>
          <CardContent className="p-6">
            {/* Header — mirrors the renewals card's mono column labels */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Spending by Category
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Monthly
              </span>
            </div>

            {/* Perforated separator */}
            <div className="border-perf mb-4" />

            {categoryGroup ? (
              <CategoryChart currency={categoryGroup.currency} data={categoryGroup.data} />
            ) : (
              <EmptyState
                tone="inline"
                title="No subscriptions yet"
                description="Add one to see where your money goes."
                action={
                  <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
                    Add subscription
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {wizardOpen && (
        <FirstRunWizard
          open
          initialStep={onboarding.step}
          initialPicks={onboarding.picks}
          initialCreated={onboarding.created}
          onSkip={(step, picks, created) => {
            updateOnboarding({ status: 'skipped', step, picks, created });
            setWizardClosed(true);
            // A skip can follow a partial failure, so rows may already exist.
            // Without this the tiles keep reading zero — and the resume strip
            // keeps showing — until the next full page load.
            if (created.length > 0) void refetchDashboard();
          }}
          onFiled={() => {
            setFiledThisSession(true);
            updateOnboarding({ ...onboarding, status: 'done', step: 3 });
            void refetchDashboard();
          }}
          onComplete={(count) => {
            setWizardClosed(true);
            if (count > 0) {
              toast.success('Setup complete.', {
                description: `${count} ${count === 1 ? 'subscription' : 'subscriptions'} added — we'll watch the renewals.`,
              });
            }
          }}
        />
      )}
    </div>
  );
}
