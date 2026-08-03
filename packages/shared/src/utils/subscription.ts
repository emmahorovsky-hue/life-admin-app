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

/** Sentinel category-filter value meaning "no category constraint". */
export const ALL_CATEGORIES = 'all';

/**
 * The subscriptions-list filter predicate: case-insensitive substring on the name, plus
 * an exact category-id match unless the filter is `ALL_CATEGORIES`.
 *
 * Web and mobile each had their own character-identical copy of this (LIF-241). Two
 * copies of one behaviour with no test between them is how the two lists drift, and
 * mobile has no test runner, so its copy could not be covered at all — here it can.
 *
 * `categoryFilter` is deliberately *not* run through `normaliseCategory`: it always comes
 * from a `cat.id` in the picker, never from user text, so tolerance would add risk for no
 * benefit. `searchTerm` is deliberately not trimmed — matching the behaviour this
 * replaces, so the extraction changes nothing.
 */
export function matchesSubscriptionFilter({
  subscription,
  searchTerm,
  categoryFilter,
}: {
  subscription: Pick<Subscription, 'name' | 'category'>;
  searchTerm: string;
  /** A CategoryId, or `ALL_CATEGORIES`. */
  categoryFilter: string;
}): boolean {
  const matchesSearch = subscription.name.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesCategory =
    categoryFilter === ALL_CATEGORIES || subscription.category === categoryFilter;
  return matchesSearch && matchesCategory;
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
