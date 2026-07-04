import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { subscriptionApi, categories, getSubscriptionStatus } from '@/lib/subscriptions';
import type { Subscription } from '@/lib/subscriptions';
import { formatCurrency } from '@/lib/currency';
import { getApiErrorMessage } from '@/lib/utils';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { parseRenewalDate, relativeDays, bucketFor } from '@life-admin/shared';
import type { BucketId } from '@life-admin/shared';

const BUCKET_LABELS: Record<BucketId, string> = {
  thisWeek: 'This Week',
  laterThisMonth: 'Later This Month',
  nextMonth: 'Next Month',
};

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

export default function Timeline() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // getAll sorts by the computed next renewal asc — already timeline order.
        const data = await subscriptionApi.getAll({ sort: 'renewalDate', order: 'asc' });
        setSubscriptions(data);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to load timeline'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const today = new Date();

  // Group into buckets, preserving the renewalDate-asc order from the API.
  const buckets: Record<BucketId, Subscription[]> = {
    thisWeek: [],
    laterThisMonth: [],
    nextMonth: [],
  };
  for (const sub of subscriptions) {
    // Cancelled subs won't be charged again — they're not "due", so skip them.
    if (getSubscriptionStatus(sub) !== 'active') continue;
    const bucket = bucketFor(parseRenewalDate(sub.nextRenewalDate), today);
    if (bucket) buckets[bucket].push(sub);
  }

  const hasAny = (Object.keys(buckets) as BucketId[]).some((id) => buckets[id].length > 0);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header — consistent with the other pages */}
      <div>
        <h2 className="text-3xl font-bold">What's due next<span className="text-brand-orange">.</span></h2>
      </div>

      {!hasAny ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nothing due in the next two months.</p>
          <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
            Add a subscription
          </Button>
        </div>
      ) : (
        (Object.keys(buckets) as BucketId[])
          .filter((id) => buckets[id].length > 0)
          .map((id) => {
            const isThisWeek = id === 'thisWeek';
            return (
              <section key={id}>
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className={`text-xs font-mono uppercase tracking-widest ${
                      isThisWeek ? 'text-brand-orange' : 'text-muted-foreground'
                    }`}
                  >
                    {BUCKET_LABELS[id]}
                  </h2>
                  {isThisWeek && (
                    <span
                      className="text-xs font-mono uppercase tracking-widest text-brand-orange border border-brand-orange px-2 py-0.5"
                      style={{ transform: 'rotate(-4deg)', display: 'inline-block' }}
                    >
                      Due Soon
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {buckets[id].map((sub) => {
                    const renewal = parseRenewalDate(sub.nextRenewalDate);
                    const days = differenceInCalendarDays(renewal, today);
                    return (
                      <div key={sub.id} className="flex items-center gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <SubscriptionLogo name={sub.name} category={sub.category} size={20} className="shrink-0" />
                          <span className="font-mono font-bold text-sm min-w-0 truncate">{sub.name}</span>
                          <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2 whitespace-nowrap">
                            {format(renewal, 'MMM d')} · {categoryLabel(sub.category)}
                          </span>
                        </div>
                        <div className="leader-dots flex-1 mx-2 mb-0.5" />
                        <span
                          className={`text-xs font-mono shrink-0 mr-3 ${
                            isThisWeek ? 'text-brand-orange' : 'text-muted-foreground'
                          }`}
                        >
                          {relativeDays(days)}
                        </span>
                        <span className="font-mono font-bold text-sm shrink-0">
                          {formatCurrency(parseFloat(sub.cost), sub.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-perf mt-6" />
              </section>
            );
          })
      )}
    </div>
  );
}
