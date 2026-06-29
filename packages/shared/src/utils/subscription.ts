import type { Subscription } from '../types/subscription';
import { parseRenewalDate } from './timeline';

// Derived lifecycle state of a subscription:
// - 'active'     — will renew normally
// - 'cancelling' — renewal stopped, but still active until its period end
// - 'ended'      — cancelled and the period end has passed
export type SubscriptionStatus = 'active' | 'cancelling' | 'ended';

// Status is derived from cancelledAt + the (frozen) nextRenewalDate. For a
// cancelled sub the server freezes nextRenewalDate at the period end, so once
// that date is in the past the subscription is "ended".
export function getSubscriptionStatus(
  sub: Pick<Subscription, 'cancelledAt' | 'nextRenewalDate'>,
  today: Date = new Date()
): SubscriptionStatus {
  if (!sub.cancelledAt) return 'active';
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return parseRenewalDate(sub.nextRenewalDate) >= start ? 'cancelling' : 'ended';
}

export function normalizeToMonthlyCost(cost: number, billingCycle: string): number {
  switch (billingCycle) {
    case 'monthly': return cost;
    case 'annual':
    case 'yearly': return cost / 12;
    case 'weekly': return cost * 4.33;
    case 'quarterly': return cost / 3;
    default: return cost;
  }
}
