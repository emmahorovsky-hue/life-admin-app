import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { subscriptionApi, categories, Subscription } from '@/lib/subscriptions';
import { formatCurrency } from '@/lib/currency';
import { getApiErrorMessage } from '@/lib/utils';

// Bucket ids in display order. Each subscription's renewalDate is assigned to the
// first matching bucket; overdue and beyond-next-month renewals are dropped.
type BucketId = 'thisWeek' | 'laterThisMonth' | 'nextMonth';

const BUCKET_LABELS: Record<BucketId, string> = {
  thisWeek: 'This Week',
  laterThisMonth: 'Later This Month',
  nextMonth: 'Next Month',
};

const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

// Relative day count → "today" / "tomorrow" / "in N days" (matches the mockup).
function relativeDays(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// Assign a subscription to a bucket from today, or null to hide it.
function bucketFor(renewal: Date, today: Date): BucketId | null {
  const days = differenceInCalendarDays(renewal, today);
  if (days < 0) return null; // overdue — hidden
  if (days <= 7) return 'thisWeek';

  const sameMonth =
    renewal.getFullYear() === today.getFullYear() && renewal.getMonth() === today.getMonth();
  if (sameMonth) return 'laterThisMonth';

  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (renewal.getFullYear() === next.getFullYear() && renewal.getMonth() === next.getMonth()) {
    return 'nextMonth';
  }
  return null; // beyond next month — hidden
}

export default function Timeline() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // getAll returns active subs sorted by renewalDate asc — already timeline order.
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
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
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
    const bucket = bucketFor(new Date(sub.renewalDate), today);
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
                    const days = differenceInCalendarDays(new Date(sub.renewalDate), today);
                    return (
                      <div key={sub.id} className="flex items-baseline gap-1">
                        <span className="font-mono font-bold text-sm shrink-0">{sub.name}</span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0 ml-2">
                          {format(new Date(sub.renewalDate), 'MMM d')} · {categoryLabel(sub.category)}
                        </span>
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
