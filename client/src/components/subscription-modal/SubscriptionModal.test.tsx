import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionModal, { SubscriptionModalMode } from './SubscriptionModal';
import { SubscriptionFormValues } from '@/lib/subscriptions';

const baseValues: SubscriptionFormValues = {
  name: '',
  cost: 0,
  currency: 'SGD',
  billingCycle: 'monthly',
  renewalDate: '2026-08-01',
  category: 'streaming',
  notes: '',
};

// Controlled harness so onChange actually updates the rendered values.
function Harness({
  mode = 'add',
  initial = baseValues,
  onSubmit,
  onDismiss,
  onCancelRenewal,
  onDelete,
}: {
  mode?: SubscriptionModalMode;
  initial?: SubscriptionFormValues;
  onSubmit?: () => void;
  onDismiss?: () => void;
  onCancelRenewal?: () => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState(initial);
  return (
    <SubscriptionModal
      mode={mode}
      title={mode === 'edit' ? 'Edit subscription.' : 'Add subscription.'}
      values={values}
      onChange={setValues}
      onSubmit={onSubmit ?? vi.fn()}
      onDismiss={onDismiss ?? vi.fn()}
      onCancelRenewal={onCancelRenewal}
      onDelete={onDelete}
    />
  );
}

describe('SubscriptionModal live receipt preview', () => {
  it('computes normalized per-month / per-year totals from cost + cycle', () => {
    render(<Harness initial={{ ...baseValues, cost: 15, billingCycle: 'monthly' }} />);

    // $15/mo → $180/yr; the total rail reads EVERY MONTH.
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('EVERY MONTH')).toBeInTheDocument();
  });

  it('normalizes a yearly cost down to a monthly figure', () => {
    render(<Harness initial={{ ...baseValues, cost: 120, billingCycle: 'yearly' }} />);
    // $120/yr → $10.00/mo.
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('EVERY YEAR')).toBeInTheDocument();
  });
});

describe('SubscriptionModal service autocomplete', () => {
  it('autofills name, cost and category from a picked suggestion', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Service name'), 'Net');
    await user.click(screen.getByRole('button', { name: /netflix/i }));

    expect(screen.getByLabelText('Service name')).toHaveValue('Netflix');
    // Netflix suggestion is $15.99/mo → the cost field reflects it.
    expect(screen.getByLabelText('Cost')).toHaveValue(15.99);
    // Category tile switches to Streaming (active = aria-pressed).
    expect(screen.getByRole('button', { name: 'Streaming' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

describe('SubscriptionModal edit-mode cancel confirm', () => {
  it('requires a two-step confirm before firing onCancelRenewal', async () => {
    const user = userEvent.setup();
    const onCancelRenewal = vi.fn();
    render(<Harness mode="edit" onCancelRenewal={onCancelRenewal} />);

    await user.click(screen.getByRole('button', { name: /cancel subscription/i }));
    expect(onCancelRenewal).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /yes, cancel it/i }));
    expect(onCancelRenewal).toHaveBeenCalledTimes(1);
  });
});
