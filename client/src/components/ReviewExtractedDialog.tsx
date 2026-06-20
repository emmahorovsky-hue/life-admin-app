import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import SubscriptionForm from '@/components/SubscriptionForm';
import {
  subscriptionApi,
  SubscriptionCandidate,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';

interface ReviewExtractedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: SubscriptionCandidate | null;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

function candidateToFormValues(candidate: SubscriptionCandidate): SubscriptionFormValues {
  return {
    name: candidate.name,
    cost: candidate.cost ?? 0,
    currency: candidate.currency ?? 'SGD',
    billingCycle: candidate.billingCycle,
    renewalDate: candidate.renewalDate ?? today(),
    category: candidate.category,
    notes: candidate.notes ?? '',
  };
}

export default function ReviewExtractedDialog({
  open,
  onOpenChange,
  candidate,
  onSuccess,
}: ReviewExtractedDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues);

  useEffect(() => {
    if (candidate) {
      setValues(candidateToFormValues(candidate));
      setError('');
    }
  }, [candidate]);

  const hint = (field: keyof SubscriptionFormValues) =>
    candidate?.uncertainFields.includes(field) ? (
      <p className="text-xs text-amber-600 dark:text-amber-500">AI-suggested — please confirm</p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.create({
        ...values,
        currency: values.currency || undefined,
        notes: values.notes || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add subscription'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Extracted Subscription</DialogTitle>
          <DialogDescription>
            We extracted these details from your receipt. Review and edit them
            before saving — nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        {candidate?.isSubscription === false && (
          <div className="text-sm text-amber-700 dark:text-amber-500 bg-amber-500/10 p-3 rounded-md">
            This looks like a one-off purchase rather than a recurring
            subscription — add it anyway?
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <SubscriptionForm
            values={values}
            onChange={setValues}
            disabled={loading}
            hint={hint}
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
              {loading ? 'Saving...' : 'Confirm & Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
