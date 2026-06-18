import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  categories,
  billingCycles,
  currencies,
  SubscriptionFormValues,
} from '@/lib/subscriptions';

interface SubscriptionFormProps {
  values: SubscriptionFormValues;
  onChange: (values: SubscriptionFormValues) => void;
  disabled?: boolean;
  /** Label for the date field — "First Payment Date *" on add, "Next Renewal Date *" on edit. */
  renewalDateLabel?: string;
  /** Optional per-field hint node (used by the review flow to flag uncertainFields). */
  hint?: (field: keyof SubscriptionFormValues) => ReactNode;
  error?: string;
}

/**
 * Presentational, controlled subscription form fields shared by the add, edit,
 * and review dialogs. Owns no state and renders no submit/footer — each dialog
 * wraps this in its own <form> with its own title and actions.
 */
export default function SubscriptionForm({
  values,
  onChange,
  disabled = false,
  renewalDateLabel = 'First Payment Date *',
  hint,
  error,
}: SubscriptionFormProps) {
  const patch = (next: Partial<SubscriptionFormValues>) => onChange({ ...values, ...next });
  const renderHint = (field: keyof SubscriptionFormValues) => hint?.(field) ?? null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">Service Name *</Label>
        <Input
          id="name"
          placeholder="Netflix, Spotify, etc."
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          disabled={disabled}
        />
        {renderHint('name')}
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
            value={values.cost}
            onChange={(e) => patch({ cost: parseFloat(e.target.value) || 0 })}
            required
            disabled={disabled}
          />
          {renderHint('cost')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            id="currency"
            value={values.currency}
            onChange={(e) => patch({ currency: e.target.value })}
            disabled={disabled}
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          {renderHint('currency')}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billingCycle">Billing Cycle *</Label>
        <Select
          id="billingCycle"
          value={values.billingCycle}
          onChange={(e) => patch({ billingCycle: e.target.value })}
          disabled={disabled}
        >
          {billingCycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.name}
            </option>
          ))}
        </Select>
        {renderHint('billingCycle')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="renewalDate">{renewalDateLabel}</Label>
        <Input
          id="renewalDate"
          type="date"
          value={values.renewalDate}
          onChange={(e) => patch({ renewalDate: e.target.value })}
          required
          disabled={disabled}
        />
        {renderHint('renewalDate')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={values.category}
          onChange={(e) => patch({ category: e.target.value })}
          disabled={disabled}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
        {renderHint('category')}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional details..."
          value={values.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          disabled={disabled}
        />
        {renderHint('notes')}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
      )}
    </>
  );
}
