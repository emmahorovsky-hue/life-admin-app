import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import SubscriptionModal, {
  SUBSCRIPTION_MODAL_CONTENT_CLASS,
} from '@/components/subscription-modal/SubscriptionModal';
import {
  subscriptionApi,
  Subscription,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
  getSubscriptionStatus,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';
import { useUnmountSafeTimeout } from '@/hooks/useUnmountSafeTimeout';

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
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues);
  const [remindersMuted, setRemindersMuted] = useState(false);
  const scheduleTimeout = useUnmountSafeTimeout();

  // Keyed on `open` as well as `subscription`: reopening the same row passes
  // the same object reference, so without `open` the form wouldn't repopulate
  // and uncommitted edits from a dismissed session would still be in the form.
  // State is adjusted during render, not in an effect, so the populated form is
  // in the same paint that shows the dialog.
  const [prevSession, setPrevSession] = useState<{
    open: boolean;
    subscription: Subscription | null;
  }>({ open: false, subscription: null });
  if (open !== prevSession.open || subscription !== prevSession.subscription) {
    setPrevSession({ open, subscription });
    if (open && subscription) {
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
      setRemindersMuted(subscription.remindersMuted);
      setError('');
    }
  }

  const handleSubmit = async () => {
    if (!subscription) return;
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.update(subscription.id, { ...values, remindersMuted });
      onSuccess();
      setSaved(true);
      scheduleTimeout(() => {
        onOpenChange(false);
        setSaved(false);
      }, 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update subscription'));
    } finally {
      setLoading(false);
    }
  };

  if (!subscription) return null;

  const status = getSubscriptionStatus(subscription);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SUBSCRIPTION_MODAL_CONTENT_CLASS}>
        <SubscriptionModal
          mode="edit"
          title="Edit subscription."
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          onDismiss={() => onOpenChange(false)}
          loading={loading}
          error={error}
          saved={saved}
          editStatus={status}
          remindersMuted={remindersMuted}
          onRemindersMutedChange={setRemindersMuted}
          onCancelRenewal={() => {
            onCancelRenewal(subscription.id);
            onOpenChange(false);
          }}
          onResume={() => {
            onResume(subscription.id);
            onOpenChange(false);
          }}
          onDelete={() => {
            onDelete(subscription.id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
