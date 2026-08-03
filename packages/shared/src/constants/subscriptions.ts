export const CATEGORY_IDS = [
  'streaming',
  'fitness',
  'software',
  'music',
  'cloud',
  'gaming',
  'productivity',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

// Keyed by CategoryId, so adding an id to CATEGORY_IDS without describing it here
// fails to compile. It used to be a plain array literal typed `{ id: CategoryId }[]`,
// which only caught the *reverse* mistake (a typo'd id) — a new id with no metadata
// compiled happily and silently vanished from GET /api/categories.
const CATEGORY_META: Record<CategoryId, { name: string; description: string }> = {
  streaming: { name: 'Streaming', description: 'Netflix, Hulu, Disney+, etc.' },
  fitness: { name: 'Fitness', description: 'Gym, ClassPass, Peloton, etc.' },
  software: { name: 'Software', description: 'Adobe, Figma, GitHub, etc.' },
  music: { name: 'Music', description: 'Spotify, Apple Music, etc.' },
  cloud: { name: 'Cloud Storage', description: 'Dropbox, iCloud, Google Drive, etc.' },
  gaming: { name: 'Gaming', description: 'Xbox Game Pass, PlayStation Plus, etc.' },
  productivity: { name: 'Productivity', description: 'Notion, Evernote, etc.' },
  other: { name: 'Other', description: 'Miscellaneous subscriptions' },
};

// Derived from CATEGORY_IDS, so this keeps the id list's order — which is the
// order GET /api/categories returns and the UI renders.
export const CATEGORIES: { id: CategoryId; name: string; description: string }[] =
  CATEGORY_IDS.map((id) => ({ id, ...CATEGORY_META[id] }));

// Simple id+name list for form pickers — derived from CATEGORIES so they can't drift.
export const categories = CATEGORIES.map(({ id, name }) => ({ id, name }));

// Collapses the cosmetic differences between an id and the ways a category can be
// written: case, surrounding space, and the separator ("cloud storage" / "cloud-storage"
// / "cloud_storage" all key the same). The separator collapse is also what resolves the
// legacy `cloud-storage` spelling documented in docs/ai-features-plan.md.
const categoryLookupKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

// Ids are registered first so an id always wins over a display name. Today nothing
// collides, but a future category *named* after another's id (a "Cloud" category
// alongside `cloud`) would otherwise silently shadow it.
const CATEGORY_BY_LOOKUP_KEY: Record<string, CategoryId> = {};
for (const id of CATEGORY_IDS) {
  CATEGORY_BY_LOOKUP_KEY[categoryLookupKey(id)] = id;
}
for (const id of CATEGORY_IDS) {
  const nameKey = categoryLookupKey(CATEGORY_META[id].name);
  if (!(nameKey in CATEGORY_BY_LOOKUP_KEY)) CATEGORY_BY_LOOKUP_KEY[nameKey] = id;
}

/**
 * Resolve arbitrary input to a CategoryId, or `null` if it isn't recognised.
 *
 * Accepts the id itself and the display name, in any case and with any separator —
 * `cloud` is the one category whose name ("Cloud Storage") differs materially from its
 * id, which made it the one most likely to arrive in a form we'd reject (LIF-241).
 *
 * Returns `null` rather than defaulting to `'other'` on purpose: this reports *whether*
 * the value was recognised, and leaves what to do about a miss — fall back, flag it,
 * reject it — to the caller. server/src/services/aiService.ts needs both facts, and a
 * non-null return would have erased one of them.
 *
 * Matching is exact-on-key, never fuzzy. "cloud backup" stays `null`; guessing there
 * would trade a silently-wrong `other` for a silently-wrong *something else*, which is
 * harder to notice and harder to undo.
 */
export function normaliseCategory(input: unknown): CategoryId | null {
  if (typeof input !== 'string') return null;
  return CATEGORY_BY_LOOKUP_KEY[categoryLookupKey(input)] ?? null;
}

export const BILLING_CYCLES = [
  'monthly',
  'annual',
  'yearly',
  'weekly',
  'quarterly',
] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number];

// Display names, keyed by BillingCycle — so adding a cycle to BILLING_CYCLES
// without naming it here fails to compile. This list used to be hand-written
// alongside BILLING_CYCLES and could silently fall out of step with it, which is
// the exact drift `categories` above avoids by deriving from CATEGORIES.
const BILLING_CYCLE_NAMES: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  yearly: 'Yearly',
  weekly: 'Weekly',
  quarterly: 'Quarterly',
};

export const billingCycles = BILLING_CYCLES.map((id) => ({
  id,
  name: BILLING_CYCLE_NAMES[id],
}));

export const currencies = ['USD', 'EUR', 'GBP', 'SGD'];
