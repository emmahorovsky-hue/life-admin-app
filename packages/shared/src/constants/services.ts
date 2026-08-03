/**
 * Starter directory of well-known services, and the matcher over it.
 *
 * Two consumers hardcoded the identical 16 rows — the web subscription modal's
 * Service autocomplete and mobile's (LIF-224 needed a third for the first-run
 * setup sheet). It is plain data with no React in it, so it belongs here rather
 * than in a third copy. Selecting an entry autofills name + category + cost +
 * billing cycle. Costs are monthly. This can later be sourced from an API.
 */
export interface ServiceSuggestion {
  name: string;
  /** Category id — aligns with CATEGORY_IDS in ./subscriptions. */
  category: string;
  /**
   * Monthly list price of the standard individual plan, per supported currency
   * (see `currencies` in ./subscriptions). Per-currency rather than one number
   * because these are *list prices in a market*, not one price converted: a UK
   * Netflix subscription is £12.99, and showing the US 15.99 under a £ sign
   * would be wrong in the one place it matters most — the first-run flow, where
   * it decides what currency the account files everything in.
   */
  costs: Record<string, number>;
  /** Billing-cycle id — aligns with BILLING_CYCLES in ./subscriptions. */
  cycle: string;
}

/**
 * Standard-plan list prices, checked 2026-08-03.
 *
 * The USD column is unchanged from the pre-per-currency catalog. GBP/EUR/SGD:
 * Netflix, Disney+, Spotify, YouTube Premium, Apple Music and iCloud+ are
 * published market prices; the rest are close approximations of the local list
 * price, because several of these vendors bill in USD outside the US or price
 * per-region in ways no single page states. Every number here is a starting
 * point the user is invited to correct — step 2 of the first-run flow exists
 * for exactly that, and the add-subscription form is one tap away. Prices move;
 * treat a stale entry as a chore, not a bug.
 */
export const SUBSCRIPTION_SUGGESTIONS: ServiceSuggestion[] = [
  { name: 'Netflix', category: 'streaming', cycle: 'monthly', costs: { USD: 15.99, EUR: 13.99, GBP: 12.99, SGD: 22.98 } },
  { name: 'Disney+', category: 'streaming', cycle: 'monthly', costs: { USD: 13.99, EUR: 9.99, GBP: 9.99, SGD: 14.98 } },
  { name: 'YouTube Premium', category: 'streaming', cycle: 'monthly', costs: { USD: 13.99, EUR: 13.99, GBP: 12.99, SGD: 13.98 } },
  { name: 'Spotify', category: 'music', cycle: 'monthly', costs: { USD: 11.99, EUR: 11.99, GBP: 12.99, SGD: 11.98 } },
  { name: 'Apple Music', category: 'music', cycle: 'monthly', costs: { USD: 10.99, EUR: 11.99, GBP: 10.99, SGD: 11.98 } },
  { name: 'Adobe Creative Cloud', category: 'software', cycle: 'monthly', costs: { USD: 59.99, EUR: 66.99, GBP: 56.98, SGD: 88.98 } },
  { name: 'Figma', category: 'software', cycle: 'monthly', costs: { USD: 12, EUR: 11.99, GBP: 9.99, SGD: 15.98 } },
  { name: 'GitHub', category: 'software', cycle: 'monthly', costs: { USD: 4, EUR: 3.99, GBP: 3.49, SGD: 5.98 } },
  { name: 'Notion', category: 'productivity', cycle: 'monthly', costs: { USD: 10, EUR: 9.99, GBP: 8.99, SGD: 13.98 } },
  { name: 'ChatGPT Plus', category: 'productivity', cycle: 'monthly', costs: { USD: 20, EUR: 22.99, GBP: 18.99, SGD: 27.98 } },
  { name: 'Dropbox', category: 'cloud', cycle: 'monthly', costs: { USD: 11.99, EUR: 11.99, GBP: 9.99, SGD: 15.98 } },
  { name: 'iCloud+', category: 'cloud', cycle: 'monthly', costs: { USD: 2.99, EUR: 2.99, GBP: 2.99, SGD: 4.98 } },
  { name: 'Xbox Game Pass', category: 'gaming', cycle: 'monthly', costs: { USD: 16.99, EUR: 17.99, GBP: 14.99, SGD: 22.98 } },
  { name: 'PlayStation Plus', category: 'gaming', cycle: 'monthly', costs: { USD: 13.99, EUR: 13.99, GBP: 10.99, SGD: 18.98 } },
  { name: 'Peloton', category: 'fitness', cycle: 'monthly', costs: { USD: 44, EUR: 39.99, GBP: 39, SGD: 59.98 } },
  { name: 'ClassPass', category: 'fitness', cycle: 'monthly', costs: { USD: 49, EUR: 45, GBP: 39, SGD: 65 } },
];

/**
 * Monthly list price in `currency`, falling back to the USD entry.
 *
 * The fallback is defensive only — every suggestion carries all four supported
 * currencies. It exists so that adding a fifth currency to `currencies` shows a
 * plausible number on day one instead of a zero, and so a hand-edit that drops
 * a key can't put "$0.00/mo" in front of a new user.
 */
export function suggestionCost(service: ServiceSuggestion, currency: string): number {
  return service.costs[currency] ?? service.costs.USD ?? 0;
}

/** Case-insensitive name match, capped at `max` results. Empty query → none. */
export function filterSuggestions(query: string, max = 5): ServiceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SUBSCRIPTION_SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, max);
}
