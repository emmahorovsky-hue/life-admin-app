import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { subscriptionApi, categories, billingCycles, Subscription, UpdateSubscriptionData } from '@/lib/subscriptions';
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
  const [formData, setFormData] = useState<UpdateSubscriptionData>({});

  useEffect(() => {
    if (subscription) {
      setFormData({
        name: subscription.name,
        cost: parseFloat(subscription.cost),
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        renewalDate: subscription.renewalDate.split('T')[0],
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
      await subscriptionApi.update(subscription.id, formData);
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
          <div className="space-y-2">
            <Label htmlFor="name">Service Name *</Label>
            <Input
              id="name"
              placeholder="Netflix, Spotify, etc."
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={loading}
            />
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
                value={formData.cost || 0}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                id="currency"
                value={formData.currency || 'SGD'}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                disabled={loading}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="SGD">SGD</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingCycle">Billing Cycle *</Label>
            <Select
              id="billingCycle"
              value={formData.billingCycle || 'monthly'}
              onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
              disabled={loading}
            >
              {billingCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="renewalDate">Next Renewal Date *</Label>
            <Input
              id="renewalDate"
              type="date"
              value={formData.renewalDate || ''}
              onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={formData.category || 'streaming'}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={loading}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={loading}
            />
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
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
