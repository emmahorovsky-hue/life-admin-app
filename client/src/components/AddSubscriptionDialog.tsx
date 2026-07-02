import { useState } from 'react';
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

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.create(values);
      onSuccess();
      // Briefly show the success state before closing and resetting.
      setSaved(true);
      window.setTimeout(() => {
        onOpenChange(false);
        setSaved(false);
        setValues(defaultSubscriptionFormValues());
      }, 1200);
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
