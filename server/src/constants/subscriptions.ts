// Subscription category ids and billing cycles now come from @life-admin/shared,
// which the client and mobile app already use — the server used to keep its own
// byte-identical copy, so a category added on one side silently didn't exist on
// the other (LIF-158). They are re-exported from here rather than imported
// directly at each call site, so the existing importers (route validators,
// aiService, tests) keep working unchanged.
export { CATEGORY_IDS, CATEGORIES, BILLING_CYCLES, currencies } from '@life-admin/shared';
export type { CategoryId, BillingCycle } from '@life-admin/shared';


// Sort constants stay server-side: they name Prisma columns and HTTP query
// values, which are not the client's business and have no meaning in the shared
// package.
//
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
