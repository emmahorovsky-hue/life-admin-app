import { describe, it, expect } from 'vitest';
import { getSubscriptionStatus, type Subscription } from '@/lib/subscriptions';

const base: Subscription = {
  id: 's1',
  userId: 'u1',
  name: 'Netflix',
  cost: '15.99',
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-06-01T00:00:00.000Z',
  nextRenewalDate: '2026-07-01T00:00:00.000Z',
  category: 'streaming',
  notes: null,
  isActive: true,
  cancelledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const TODAY = new Date('2026-06-30T12:00:00.000Z');

describe('getSubscriptionStatus', () => {
  it('is active when not cancelled', () => {
    expect(getSubscriptionStatus(base, TODAY)).toBe('active');
  });

  it('is cancelling when cancelled and period end is in the future', () => {
    const sub = { ...base, cancelledAt: '2026-06-15T00:00:00.000Z', nextRenewalDate: '2026-07-10T00:00:00.000Z' };
    expect(getSubscriptionStatus(sub, TODAY)).toBe('cancelling');
  });

  it('is cancelling on the period-end day itself (boundary)', () => {
    const sub = { ...base, cancelledAt: '2026-06-15T00:00:00.000Z', nextRenewalDate: '2026-06-30T00:00:00.000Z' };
    expect(getSubscriptionStatus(sub, TODAY)).toBe('cancelling');
  });

  it('is ended when cancelled and the period end has passed', () => {
    const sub = { ...base, cancelledAt: '2026-05-15T00:00:00.000Z', nextRenewalDate: '2026-06-29T00:00:00.000Z' };
    expect(getSubscriptionStatus(sub, TODAY)).toBe('ended');
  });
});
