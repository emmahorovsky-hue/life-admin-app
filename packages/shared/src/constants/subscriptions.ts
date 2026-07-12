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
