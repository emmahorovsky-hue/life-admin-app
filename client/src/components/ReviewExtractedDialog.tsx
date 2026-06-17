import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  subscriptionApi,
  categories,
  billingCycles,
  CreateSubscriptionData,
  SubscriptionCandidate,
} from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';

interface ReviewExtractedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: SubscriptionCandidate | null;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

function candidateToFormData(candidate: SubscriptionCandidate): CreateSubscriptionData {
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
  const [formData, setFormData] = useState<CreateSubscriptionData>({
    name: '',
    cost: 0,
    currency: 'SGD',
    billingCycle: 'monthly',
    renewalDate: today(),
    category: 'streaming',
    notes: '',
  });

  useEffect(() => {
    if (candidate) {
      setFormData(candidateToFormData(candidate));
      setError('');
    }
  }, [candidate]);

  const uncertain = (field: string) =>
    candidate?.uncertainFields.includes(field) ?? false;

  const hint = (field: string) =>
    uncertain(field) ? (
      <p className="text-xs text-amber-600 dark:text-amber-500">
        AI-suggested — please confirm
      </p>
    ) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await subscriptionApi.create({
        ...formData,
        currency: formData.currency || undefined,
        notes: formData.notes || undefined,
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
          <div className="space-y-2">
            <Label htmlFor="name">Service Name *</Label>
            <Input
              id="name"
              placeholder="Netflix, Spotify, etc."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
            {hint('name')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })
                }
                required
                disabled={loading}
              />
              {hint('cost')}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                disabled={loading}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="SGD">SGD</option>
              </Select>
              {hint('currency')}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingCycle">Billing Cycle *</Label>
            <Select
              id="billingCycle"
              value={formData.billingCycle}
              onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
              disabled={loading}
            >
              {billingCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </Select>
            {hint('billingCycle')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="renewalDate">First Payment Date *</Label>
            <Input
              id="renewalDate"
              type="date"
              value={formData.renewalDate}
              onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
              required
              disabled={loading}
            />
            {hint('renewalDate')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={loading}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            {hint('category')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={loading}
            />
            {hint('notes')}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

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
