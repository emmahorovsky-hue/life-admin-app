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
