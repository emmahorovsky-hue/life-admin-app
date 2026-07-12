// Single source of truth for subscription category ids and billing cycles.
// Imported by categoryController (the /api/categories response), the subscription
// route validators, and aiService's extraction schema so the three can't drift.

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

// Rich category metadata served by GET /api/categories. The `id` is typed against
// CATEGORY_IDS, so a typo or a category added here without updating the id list fails to compile.
export const CATEGORIES: { id: CategoryId; name: string; description: string }[] = [
  { id: 'streaming', name: 'Streaming', description: 'Netflix, Hulu, Disney+, etc.' },
  { id: 'fitness', name: 'Fitness', description: 'Gym, ClassPass, Peloton, etc.' },
  { id: 'software', name: 'Software', description: 'Adobe, Figma, GitHub, etc.' },
  { id: 'music', name: 'Music', description: 'Spotify, Apple Music, etc.' },
  { id: 'cloud', name: 'Cloud Storage', description: 'Dropbox, iCloud, Google Drive, etc.' },
  { id: 'gaming', name: 'Gaming', description: 'Xbox Game Pass, PlayStation Plus, etc.' },
  { id: 'productivity', name: 'Productivity', description: 'Notion, Evernote, etc.' },
  { id: 'other', name: 'Other', description: 'Miscellaneous subscriptions' },
];

export const BILLING_CYCLES = [
  'monthly',
  'annual',
  'yearly',
  'weekly',
  'quarterly',
] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number];

// Columns the subscriptions list endpoint may sort by (LIF-144). Whitelisted so a
// raw query value never reaches Prisma's orderBy — an unknown column there throws
// a PrismaClientValidationError and would surface as a 500.
export const SUBSCRIPTION_SORT_FIELDS = [
  'name',
  'cost',
  'renewalDate',
  'category',
  'createdAt',
] as const;

export type SubscriptionSortField = (typeof SUBSCRIPTION_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];
