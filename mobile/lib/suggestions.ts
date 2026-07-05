/**
 * Starter directory for the Service autocomplete in the subscription form.
 * Selecting a suggestion autofills name + category + cost + billing cycle.
 * Costs are monthly. Mirrors client/src/components/subscription-modal/suggestions.ts.
 */
export interface ServiceSuggestion {
  name: string;
  /** Category id — aligns with CATEGORY_IDS in @life-admin/shared. */
  category: string;
  cost: number;
  /** Billing-cycle id — aligns with billingCycles in @life-admin/shared. */
  cycle: string;
}

export const SUBSCRIPTION_SUGGESTIONS: ServiceSuggestion[] = [
  { name: 'Netflix', category: 'streaming', cost: 15.99, cycle: 'monthly' },
  { name: 'Disney+', category: 'streaming', cost: 13.99, cycle: 'monthly' },
  { name: 'YouTube Premium', category: 'streaming', cost: 13.99, cycle: 'monthly' },
  { name: 'Spotify', category: 'music', cost: 11.99, cycle: 'monthly' },
  { name: 'Apple Music', category: 'music', cost: 10.99, cycle: 'monthly' },
  { name: 'Adobe Creative Cloud', category: 'software', cost: 59.99, cycle: 'monthly' },
  { name: 'Figma', category: 'software', cost: 12, cycle: 'monthly' },
  { name: 'GitHub', category: 'software', cost: 4, cycle: 'monthly' },
  { name: 'Notion', category: 'productivity', cost: 10, cycle: 'monthly' },
  { name: 'ChatGPT Plus', category: 'productivity', cost: 20, cycle: 'monthly' },
  { name: 'Dropbox', category: 'cloud', cost: 11.99, cycle: 'monthly' },
  { name: 'iCloud+', category: 'cloud', cost: 2.99, cycle: 'monthly' },
  { name: 'Xbox Game Pass', category: 'gaming', cost: 16.99, cycle: 'monthly' },
  { name: 'PlayStation Plus', category: 'gaming', cost: 13.99, cycle: 'monthly' },
  { name: 'Peloton', category: 'fitness', cost: 44, cycle: 'monthly' },
  { name: 'ClassPass', category: 'fitness', cost: 49, cycle: 'monthly' },
];

/** Case-insensitive name match, capped at `max` results. Empty query → none. */
export function filterSuggestions(query: string, max = 5): ServiceSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SUBSCRIPTION_SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, max);
}
