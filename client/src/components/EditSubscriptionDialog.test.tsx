import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditSubscriptionDialog from './EditSubscriptionDialog';
import type { Subscription } from '@/lib/subscriptions';

const activeSub: Subscription = {
  id: 's1',
  userId: 'u1',
  name: 'Netflix',
  cost: '15.99',
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-07-01T00:00:00.000Z',
  nextRenewalDate: '2099-07-01T00:00:00.000Z', // far future → always "active"/"cancelling"
  category: 'streaming',
  notes: null,
  isActive: true,
  cancelledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderDialog(sub: Subscription) {
  const onCancelRenewal = vi.fn();
  const onResume = vi.fn();
  render(
    <EditSubscriptionDialog
      open
      onOpenChange={vi.fn()}
      subscription={sub}
      onSuccess={vi.fn()}
      onDelete={vi.fn()}
      onCancelRenewal={onCancelRenewal}
      onResume={onResume}
    />
  );
  return { onCancelRenewal, onResume };
}

describe('EditSubscriptionDialog cancel / resume', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Cancel subscription" for an active sub and calls onCancelRenewal after confirming', async () => {
    const { onCancelRenewal, onResume } = renderDialog(activeSub);
    const button = screen.getByRole('button', { name: /cancel subscription/i });
    expect(screen.queryByRole('button', { name: /resume subscription/i })).toBeNull();

    // Clicking opens the inline confirm — no action fires yet.
    await userEvent.click(button);
    expect(onCancelRenewal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /yes, cancel it/i }));
    expect(onCancelRenewal).toHaveBeenCalledWith('s1');
    expect(onResume).not.toHaveBeenCalled();
  });

  it('shows "Resume subscription" for a cancelling sub and calls onResume', async () => {
    const cancellingSub = { ...activeSub, cancelledAt: '2026-06-15T00:00:00.000Z' };
    const { onResume, onCancelRenewal } = renderDialog(cancellingSub);

    const button = screen.getByRole('button', { name: /resume subscription/i });
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).toBeNull();

    await userEvent.click(button);
    expect(onResume).toHaveBeenCalledWith('s1');
    expect(onCancelRenewal).not.toHaveBeenCalled();
  });
});
