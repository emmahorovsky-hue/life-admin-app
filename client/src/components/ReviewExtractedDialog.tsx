import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import SubscriptionModal, {
  SUBSCRIPTION_MODAL_CONTENT_CLASS,
} from '@/components/subscription-modal/SubscriptionModal';
import {
  subscriptionApi,
  SubscriptionCandidate,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';
import { useUnmountSafeTimeout } from '@/hooks/useUnmountSafeTimeout';

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
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues);
  const scheduleTimeout = useUnmountSafeTimeout();

  useEffect(() => {
    if (candidate) {
      setValues(candidateToFormValues(candidate));
      setError('');
    }
  }, [candidate]);

  const hint = (field: keyof SubscriptionFormValues) =>
    candidate?.uncertainFields.includes(field) ? (
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
        AI-suggested — please confirm
      </p>
    ) : null;

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.create({
        ...values,
        currency: values.currency || undefined,
        notes: values.notes || undefined,
      });
      onSuccess();
      setSaved(true);
      scheduleTimeout(() => {
        onOpenChange(false);
        setSaved(false);
      }, 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add subscription'));
    } finally {
      setLoading(false);
    }
  };

  const banner = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        We extracted these details from your receipt. Review and edit them before saving — nothing
        is saved until you confirm.
      </p>
      {candidate?.isSubscription === false && (
        <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-500">
          This looks like a one-off purchase rather than a recurring subscription — add it anyway?
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SUBSCRIPTION_MODAL_CONTENT_CLASS}>
        <SubscriptionModal
          mode="add"
          title="Review subscription."
          submitLabel="Confirm & add"
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          onDismiss={() => onOpenChange(false)}
          loading={loading}
          error={error}
          saved={saved}
          banner={banner}
          hint={hint}
        />
      </DialogContent>
    </Dialog>
  );
}
