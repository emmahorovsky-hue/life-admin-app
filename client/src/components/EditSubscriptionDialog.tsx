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
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';

interface EditSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  onSuccess: () => void;
  onDelete: (id: string) => void;
}

export default function EditSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  onSuccess,
  onDelete,
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

  if (!subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Edit Subscription</DialogTitle>
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
              Cancel
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
