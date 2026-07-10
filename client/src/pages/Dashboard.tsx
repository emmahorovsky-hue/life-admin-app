import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/dashboard';
import type { DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi, categories } from '@/lib/subscriptions';
import { formatCurrency, dominantCurrency, DEFAULT_CURRENCY } from '@/lib/currency';
import { normalizeToMonthlyCost } from '@life-admin/shared';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { PaperSheet } from '@/components/PaperSheet';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<{ name: string; total: number }[]>([]);
  // Currency the user predominantly uses, for aggregate figures, plus a per-id
  // lookup so each renewal row can render in its own subscription's currency.
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

        setDisplayCurrency(dominantCurrency(allSubs.map((sub) => sub.currency)));
        setCurrencyById(new Map(allSubs.map((sub) => [sub.id, sub.currency])));

        const categoryMap = new Map<string, number>();
        allSubs.forEach((sub) => {
          const monthlyCost = normalizeToMonthlyCost(parseFloat(sub.cost), sub.billingCycle);
          const current = categoryMap.get(sub.category) || 0;
          categoryMap.set(sub.category, current + monthlyCost);
        });

        const chartData = Array.from(categoryMap.entries())
          .map(([category, total]) => ({
            name: categories.find(c => c.id === category)?.name || category,
            total: Math.round(total * 100) / 100,
          }))
          .sort((a, b) => b.total - a.total);

        setCategoryData(chartData);
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

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const dueSoonRenewals = summary.upcomingRenewals.filter(
    r => new Date(r.nextRenewalDate).getTime() - Date.now() <= sevenDaysMs
  );
  const dueSoonTotal = dueSoonRenewals.reduce((sum, r) => sum + parseFloat(r.cost), 0);

  const shownRenewals = summary.upcomingRenewals.slice(0, 5);
  // Total covers every upcoming renewal, not just the 5 rows shown — the
  // label calls that out below when the list is truncated.
  const renewalTotal = summary.upcomingRenewals.reduce((sum, r) => sum + parseFloat(r.cost), 0);

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
            <div className="text-4xl font-bold font-mono tracking-tight">
              {formatCurrency(summary.totalMonthlySpend, displayCurrency)}
            </div>
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
            <div className="text-4xl font-bold font-mono tracking-tight">
              {formatCurrency(summary.totalAnnualSpend, displayCurrency)}
            </div>
          </CardContent>
        </Card>

        {/* Due soon */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
              Due in 7 days
            </p>
            <div className="text-4xl font-bold font-mono tracking-tight">
              {formatCurrency(dueSoonTotal, displayCurrency)}
            </div>
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
                        {format(new Date(renewal.nextRenewalDate), 'MMM d')}
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

                {/* Total due */}
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Total{summary.upcomingRenewals.length > shownRenewals.length
                      ? ` · all ${summary.upcomingRenewals.length}`
                      : ''}
                  </span>
                  <span className="font-mono font-bold text-2xl text-foreground">
                    {formatCurrency(renewalTotal, displayCurrency)}
                  </span>
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

        {/* Category breakdown chart */}
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

            {categoryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No subscriptions yet</p>
                <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
                  Add Subscription
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="2 4"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
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
                    formatter={(value: number) => [formatCurrency(value, displayCurrency), 'Monthly']}
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
