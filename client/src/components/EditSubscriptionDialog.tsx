import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SubscriptionForm from '@/components/SubscriptionForm';
import {
  subscriptionApi,
  Subscription,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
  getSubscriptionStatus,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';
import { format } from 'date-fns';

interface EditSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  onSuccess: () => void;
  onDelete: (id: string) => void;
  onCancelRenewal: (id: string) => void;
  onResume: (id: string) => void;
}

export default function EditSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess,
  onDelete,
  onCancelRenewal,
  onResume,
}: EditSubscriptionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues);

  useEffect(() => {
    if (subscription) {
      setValues({
        name: subscription.name,
        cost: parseFloat(subscription.cost),
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        // Show the computed next renewal (matches what's displayed elsewhere).
        // Saving untouched re-anchors the stored date to this value.
        renewalDate: subscription.nextRenewalDate.split('T')[0],
        category: subscription.category,
        notes: subscription.notes || '',
      });
    }
  }, [subscription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription) return;

    setError('');
    setLoading(true);

    try {
      await subscriptionApi.update(subscription.id, values);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update subscription'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (subscription && window.confirm(`Delete ${subscription.name}? This action cannot be undone.`)) {
      onDelete(subscription.id);
      onOpenChange(false);
    }
  };

  const handleCancelRenewal = () => {
    if (!subscription) return;
    const endDate = format(new Date(subscription.nextRenewalDate), 'MMM d, yyyy');
    if (
      window.confirm(
        `${subscription.name} will stay active until ${endDate}, then it won't renew. You can resume any time before then.`
      )
    ) {
      onCancelRenewal(subscription.id);
      onOpenChange(false);
    }
  };

  const handleResume = () => {
    if (!subscription) return;
    onResume(subscription.id);
    onOpenChange(false);
  };

  if (!subscription) return null;

  const status = getSubscriptionStatus(subscription);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between items-center gap-2">
            <DialogTitle>Edit Subscription</DialogTitle>
            <div className="flex gap-2">
              {status === 'active' && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCancelRenewal}
                  disabled={loading}
                  className="bg-warning text-white border-0 hover:bg-warning/90"
                >
                  Cancel subscription
                </Button>
              )}
              {status === 'cancelling' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  disabled={loading}
                >
                  Resume subscription
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <SubscriptionForm
            values={values}
            onChange={setValues}
            disabled={loading}
            renewalDateLabel="Next Renewal Date *"
            error={error}
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Close
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
