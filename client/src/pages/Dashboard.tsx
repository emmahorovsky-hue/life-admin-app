import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi, categories } from '@/lib/subscriptions';
import { format, formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [summaryData, allSubs] = await Promise.all([
          dashboardApi.getSummary(),
          subscriptionApi.getAll(),
        ]);
        setSummary(summaryData);

        // Calculate category breakdown
        const categoryMap = new Map<string, number>();
        allSubs.forEach((sub) => {
          const cost = parseFloat(sub.cost);
          const monthlyCost = sub.billingCycle === 'monthly' ? cost :
                             sub.billingCycle === 'annual' || sub.billingCycle === 'yearly' ? cost / 12 :
                             sub.billingCycle === 'weekly' ? cost * 4.33 :
                             sub.billingCycle === 'quarterly' ? cost / 3 : cost;
          
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">
          Welcome back, {user?.name || user?.email?.split('@')[0]}
        </h2>
        <p className="text-muted-foreground">
          Here's your subscription overview
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${summary.totalMonthlySpend.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Annual Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${summary.totalAnnualSpend.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Two columns: Upcoming renewals and category chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming renewals */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.upcomingRenewals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No renewals in the next 30 days
              </p>
            ) : (
              <div className="space-y-3">
                {summary.upcomingRenewals.slice(0, 5).map((renewal) => (
                  <div
                    key={renewal.id}
                    className="flex justify-between items-center p-3 rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">{renewal.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(renewal.renewalDate), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${parseFloat(renewal.cost).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(renewal.renewalDate), 'MMM d')}
                      </div>
                    </div>
                  </div>
                ))}
                {summary.upcomingRenewals.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/subscriptions')}
                  >
                    View all {summary.upcomingRenewals.length} renewals
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No subscriptions yet</p>
                <Button onClick={() => navigate('/subscriptions')}>
                  Add Subscription
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '0.5rem',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Monthly']}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
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
            <Button onClick={() => navigate('/subscriptions')}>
              Add Your First Subscription
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
