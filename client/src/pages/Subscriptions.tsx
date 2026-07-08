import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  subscriptionApi,
  Subscription,
  SubscriptionCandidate,
  categories,
  getSubscriptionStatus,
} from '@/lib/subscriptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import { PaperSheet } from '@/components/PaperSheet';
import { PAPER_TINTS, PAPER_SHADOW, PAPER_RULING } from '@/lib/paper';
import AddSubscriptionDialog from '@/components/AddSubscriptionDialog';
import EditSubscriptionDialog from '@/components/EditSubscriptionDialog';
import UploadReceiptDialog from '@/components/UploadReceiptDialog';
import ReviewExtractedDialog from '@/components/ReviewExtractedDialog';
import { format, differenceInCalendarDays } from 'date-fns';
import { parseRenewalDate } from '@life-admin/shared';
import { formatCurrency } from '@/lib/currency';
import { getApiErrorMessage } from '@/lib/utils';

export default function Subscriptions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [extractedCandidate, setExtractedCandidate] = useState<SubscriptionCandidate | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await subscriptionApi.getAll();
      setSubscriptions(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load subscriptions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Open the upload flow directly when navigated here from an "add" button
  // elsewhere (e.g. the Dashboard). Clear the state so it doesn't re-fire on refresh/back.
  useEffect(() => {
    if ((location.state as { openAdd?: boolean } | null)?.openAdd) {
      setUploadDialogOpen(true);
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: null,
      });
    }
  }, [location, navigate]);

  const handleDelete = async (id: string) => {
    try {
      await subscriptionApi.delete(id);
      await loadSubscriptions();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to delete subscription'));
    }
  };

  const handleCancelRenewal = async (id: string) => {
    try {
      await subscriptionApi.cancel(id);
      await loadSubscriptions();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to cancel subscription'));
    }
  };

  const handleResume = async (id: string) => {
    try {
      await subscriptionApi.resume(id);
      await loadSubscriptions();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to resume subscription'));
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setEditDialogOpen(true);
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || sub.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Sort by soonest renewal first — the whole grid reads as a "what's due next" file.
  const today = new Date();
  const sortedSubscriptions = [...filteredSubscriptions].sort(
    (a, b) => parseRenewalDate(a.nextRenewalDate).getTime() - parseRenewalDate(b.nextRenewalDate).getTime()
  );

  const isFiltered = searchTerm !== '' || categoryFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h2 className="font-sans font-extrabold text-3xl tracking-tight">
            Subscriptions<span className="text-brand-orange">.</span>
          </h2>
        </div>
        <div className="flex gap-2.5 items-center">
          <Input
            placeholder="Search…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-44"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-36"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Button onClick={() => setUploadDialogOpen(true)}>+ Add</Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
          role="status"
          aria-label="Loading subscriptions"
        >
          {[1, 2, 3, 4].map((i) => (
            <PaperSheet
              key={i}
              tint={PAPER_TINTS[i % PAPER_TINTS.length]}
              marginRuleClassName="left-[30px]"
              className="pt-5 pr-[22px] pb-[18px] pl-[46px] [transform:rotate(-0.5deg)]"
            >
              <div className="flex items-center gap-[11px] mb-3 animate-pulse">
                <div className="w-10 h-10 rounded-md bg-black/[0.07]" />
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-28 bg-black/[0.07] rounded" />
                  <div className="h-3 w-16 bg-black/[0.07] rounded" />
                </div>
              </div>
              <div className="h-6 w-24 bg-black/[0.07] rounded mb-3.5 animate-pulse" />
              <div className="h-3 w-full bg-black/[0.07] rounded animate-pulse" />
            </PaperSheet>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sortedSubscriptions.length === 0 && (
        <div className="space-y-4">
          <div className="py-10 text-center border border-dashed border-border rounded-lg font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
            {isFiltered ? 'No subscriptions match your filters' : 'No subscriptions yet'}
          </div>
          {!isFiltered && (
            <div className="text-center">
              <Button onClick={() => setUploadDialogOpen(true)}>
                Add Your First Subscription
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Card grid */}
      {!loading && sortedSubscriptions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {sortedSubscriptions.map((sub, i) => {
            const status = getSubscriptionStatus(sub);
            const renewal = parseRenewalDate(sub.nextRenewalDate);
            const days = differenceInCalendarDays(renewal, today);
            const isUrgent = status === 'cancelling' || days <= 7;
            const stampText = status === 'cancelling' ? 'Ending' : `Due · ${days}d`;
            const categoryName =
              categories.find((c) => c.id === sub.category)?.name || sub.category;

            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleEdit(sub)}
                aria-label={`Edit ${sub.name}`}
                style={{ backgroundColor: PAPER_TINTS[i % PAPER_TINTS.length], boxShadow: PAPER_SHADOW }}
                className={`group relative w-full text-left overflow-hidden rounded-[3px] border border-black/[0.06] cursor-pointer pt-5 pr-[22px] pb-[18px] pl-[46px] [transform:rotate(-0.5deg)] transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:[transform:rotate(0deg)_translateY(-3px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:[transform:rotate(-0.5deg)] ${
                  status === 'ended' ? 'opacity-60' : ''
                }`}
              >
                {/* Horizontal paper ruling */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: PAPER_RULING, backgroundPosition: '0 76px' }}
                />
                {/* Left margin rule */}
                <span
                  aria-hidden="true"
                  className="absolute left-[30px] top-0 bottom-0 w-px"
                  style={{ background: 'hsl(2 65% 58% / 0.30)' }}
                />

                {/* Content sits above the ruling */}
                <div className="relative">
                {/* Top row: logo + name/category, urgent stamp */}
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex items-center gap-[11px] min-w-0">
                    <SubscriptionLogo name={sub.name} category={sub.category} size={40} />
                    <div className="flex flex-col gap-[5px] min-w-0">
                      <span className="font-sans font-extrabold text-lg tracking-tight text-foreground truncate">
                        {sub.name}
                      </span>
                      <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted-foreground truncate">
                        {categoryName}
                      </span>
                    </div>
                  </div>
                  {isUrgent && (
                    <span className="shrink-0 inline-block [transform:rotate(-5deg)] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-brand-orange border-[1.5px] border-brand-orange rounded-[2px] px-1.5 py-0.5 whitespace-nowrap">
                      {stampText}
                    </span>
                  )}
                </div>

                {/* Price row */}
                <div className="flex items-baseline gap-1.5 mb-3.5">
                  <span className="font-mono font-bold text-[26px] tabular-nums text-foreground">
                    {formatCurrency(parseFloat(sub.cost), sub.currency)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    / {sub.billingCycle.toLowerCase()}
                  </span>
                </div>

                {/* Renewal row with dotted leader */}
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-muted-foreground shrink-0">
                    Renews {format(renewal, 'MMM d')}
                  </span>
                  <span aria-hidden="true" className="leader-dots flex-1 mx-2 mb-[3px]" />
                  <span className="font-mono text-[11px] font-bold tracking-[0.04em] text-foreground shrink-0">
                    {days}d left
                  </span>
                </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddSubscriptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={loadSubscriptions}
      />

      <EditSubscriptionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        subscription={selectedSubscription}
        onSuccess={loadSubscriptions}
        onDelete={handleDelete}
        onCancelRenewal={handleCancelRenewal}
        onResume={handleResume}
      />

      <UploadReceiptDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onExtracted={(candidate) => {
          setExtractedCandidate(candidate);
          setUploadDialogOpen(false);
          setReviewDialogOpen(true);
        }}
        onManual={() => {
          setUploadDialogOpen(false);
          setAddDialogOpen(true);
        }}
      />

      <ReviewExtractedDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        candidate={extractedCandidate}
        onSuccess={loadSubscriptions}
      />
    </div>
  );
}
