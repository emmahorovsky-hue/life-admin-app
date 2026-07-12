import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import SubscriptionModal, {
  SUBSCRIPTION_MODAL_CONTENT_CLASS,
} from '@/components/subscription-modal/SubscriptionModal';
import {
  subscriptionApi,
  SubscriptionFormValues,
  defaultSubscriptionFormValues,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';
import { useUnmountSafeTimeout } from '@/hooks/useUnmountSafeTimeout';

interface AddSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddSubscriptionDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddSubscriptionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<SubscriptionFormValues>(defaultSubscriptionFormValues);
  const scheduleTimeout = useUnmountSafeTimeout();

  // Every open starts from a blank form, however the last one ended — saved,
  // dismissed via the X, or closed with a failed save still on screen. Keyed on
  // open (rather than resetting on close) so the fields can't blank out while
  // the dialog is animating away; same approach as EditSubscriptionDialog.
  useEffect(() => {
    if (open) {
      setValues(defaultSubscriptionFormValues());
      setError('');
      setSaved(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.create(values);
      onSuccess();
      // Briefly show the success state before closing; the open effect above
      // clears the form for the next session.
      setSaved(true);
      scheduleTimeout(() => onOpenChange(false), 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to add subscription'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SUBSCRIPTION_MODAL_CONTENT_CLASS}>
        <SubscriptionModal
          mode="add"
          title="Add subscription."
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          onDismiss={() => onOpenChange(false)}
          loading={loading}
          error={error}
          saved={saved}
        />
      </DialogContent>
    </Dialog>
  );
}
