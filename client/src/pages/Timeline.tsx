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

// "Filed paper" treatment, mirrored from the Subscriptions card grid: a warm
// cream sheet with a layered warm shadow, a soft red left margin rule and a
// faint blue horizontal ruling — so the timeline reads as one filed statement.
const PAPER_TINT = '#fbf8f1';
const PAPER_SHADOW =
  '0 1px 2px rgba(40,33,20,0.04), 0 4px 10px rgba(40,33,20,0.05), 0 12px 26px rgba(40,33,20,0.06)';

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
          <div className="h-9 bg-muted rounded w-1/3" />
        </div>
        <div
          className="relative overflow-hidden rounded-[3px] border border-black/[0.06] pt-7 pr-7 pb-7 pl-12"
          style={{ backgroundColor: PAPER_TINT, boxShadow: PAPER_SHADOW }}
        >
          {/* Left margin rule — matches the loaded sheet */}
          <span
            aria-hidden="true"
            className="absolute left-8 top-0 bottom-0 w-px"
            style={{ background: 'hsl(2 65% 58% / 0.30)' }}
          />
          <div className="relative space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3.5 animate-pulse">
                <div className="w-9 h-9 rounded-md bg-black/[0.07] shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-4 w-32 bg-black/[0.07] rounded" />
                  <div className="h-3 w-20 bg-black/[0.07] rounded" />
                </div>
                <div className="h-5 w-16 bg-black/[0.07] rounded" />
              </div>
            ))}
          </div>
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
        <h2 className="font-sans font-extrabold text-3xl tracking-tight">
          What's due next<span className="text-brand-orange">.</span>
        </h2>
      </div>

      {!hasAny ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nothing due in the next two months.</p>
          <Button onClick={() => navigate('/subscriptions', { state: { openAdd: true } })}>
            Add a subscription
          </Button>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-[3px] border border-black/[0.06] pt-7 pr-7 pb-7 pl-12 [transform:rotate(-0.4deg)]"
          style={{ backgroundColor: PAPER_TINT, boxShadow: PAPER_SHADOW }}
        >
          {/* Left margin rule */}
          <span
            aria-hidden="true"
            className="absolute left-8 top-0 bottom-0 w-px"
            style={{ background: 'hsl(2 65% 58% / 0.30)' }}
          />

          <div className="relative space-y-9">
            {(Object.keys(buckets) as BucketId[])
              .filter((id) => buckets[id].length > 0)
              .map((id) => {
                const isThisWeek = id === 'thisWeek';
                return (
                  <section key={id}>
                    <div className="flex items-center justify-between mb-4">
                      <h3
                        className={`text-xs font-mono uppercase tracking-widest ${
                          isThisWeek ? 'text-brand-orange' : 'text-muted-foreground'
                        }`}
                      >
                        {BUCKET_LABELS[id]}
                      </h3>
                      {isThisWeek && (
                        <span
                          className="text-[10px] font-mono uppercase tracking-widest text-brand-orange border-[1.5px] border-brand-orange rounded-[2px] px-2 py-0.5"
                          style={{ transform: 'rotate(-4deg)', display: 'inline-block' }}
                        >
                          Due Soon
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-dashed divide-black/[0.08]">
                      {buckets[id].map((sub) => {
                        const renewal = parseRenewalDate(sub.nextRenewalDate);
                        const days = differenceInCalendarDays(renewal, today);
                        return (
                          <div key={sub.id} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                            <SubscriptionLogo
                              name={sub.name}
                              category={sub.category}
                              size={36}
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-sans font-bold text-base tracking-tight text-foreground truncate">
                                {sub.name}
                              </div>
                              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground truncate">
                                {format(renewal, 'MMM d')} · {categoryLabel(sub.category)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="font-mono font-bold text-base tabular-nums text-foreground">
                                {formatCurrency(parseFloat(sub.cost), sub.currency)}
                              </div>
                              <div
                                className={`font-mono text-[11px] tracking-[0.04em] ${
                                  isThisWeek ? 'text-brand-orange' : 'text-muted-foreground'
                                }`}
                              >
                                {relativeDays(days)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
