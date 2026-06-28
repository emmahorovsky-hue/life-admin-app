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

export const billingCycles = [
  { id: 'monthly', name: 'Monthly' },
  { id: 'annual', name: 'Annual' },
  { id: 'yearly', name: 'Yearly' },
  { id: 'weekly', name: 'Weekly' },
  { id: 'quarterly', name: 'Quarterly' },
];

export const currencies = ['USD', 'EUR', 'GBP', 'SGD'];
