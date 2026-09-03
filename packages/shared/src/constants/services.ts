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
 * Standard-plan list prices, per supported currency.
 *
 * Provenance, because these numbers vary a lot in how solid they are:
 *
 * - USD/EUR/GBP/SGD are unchanged from the four-currency catalog (checked
 *   2026-08-03). Netflix, Disney+, Spotify, YouTube Premium, Apple Music and
 *   iCloud+ were published market prices; the rest were close approximations.
 * - The sixteen currencies added on 2026-09-03 are **market-plausible list
 *   prices at local price points, not individually verified against sixteen
 *   vendor pricing pages.** They are right in magnitude and right in shape (a
 *   Polish user sees 49, not 15.99; a Japanese user sees 1590, not 15.99), and
 *   several vendors either bill in USD in these markets or do not sell there
 *   at all — Peloton and ClassPass most of all — in which case the entry is
 *   the local-price-point equivalent so the field is never blank or zero.
 *
 * Every number here is a starting point the user is invited to correct — step
 * 2 of the first-run flow exists for exactly that, and the add-subscription
 * form is one tap away. Prices move; treat a stale entry as a chore, not a bug.
 *
 * Keys are ordered as `currencies` is, so a missing one is easy to spot by eye.
 * A test asserts every service prices every supported currency, which is what
 * actually stops a new currency shipping with a US price under its sign.
 */
export const SUBSCRIPTION_SUGGESTIONS: ServiceSuggestion[] = [
  {
    name: 'Netflix', category: 'streaming', cycle: 'monthly',
    costs: {
      AED: 39, AUD: 20.99, BRL: 44.9, CAD: 18.99, CHF: 24.9, CZK: 279,
      DKK: 129, EUR: 13.99, GBP: 12.99, HKD: 78, HUF: 4490, INR: 499,
      JPY: 1590, MYR: 35, NOK: 159, NZD: 21.99, PLN: 49, SEK: 149,
      SGD: 22.98, USD: 15.99,
    },
  },
  {
    name: 'Disney+', category: 'streaming', cycle: 'monthly',
    costs: {
      AED: 29.99, AUD: 15.99, BRL: 43.9, CAD: 11.99, CHF: 13.9, CZK: 199,
      DKK: 99, EUR: 9.99, GBP: 9.99, HKD: 73, HUF: 2990, INR: 299,
      JPY: 1140, MYR: 34.9, NOK: 129, NZD: 15.99, PLN: 37.99, SEK: 119,
      SGD: 14.98, USD: 13.99,
    },
  },
  {
    name: 'YouTube Premium', category: 'streaming', cycle: 'monthly',
    costs: {
      AED: 23.99, AUD: 16.99, BRL: 24.9, CAD: 12.99, CHF: 15.9, CZK: 179,
      DKK: 99, EUR: 13.99, GBP: 12.99, HKD: 68, HUF: 2490, INR: 149,
      JPY: 1280, MYR: 17.9, NOK: 139, NZD: 17.99, PLN: 25.99, SEK: 129,
      SGD: 13.98, USD: 13.99,
    },
  },
  {
    name: 'Spotify', category: 'music', cycle: 'monthly',
    costs: {
      AED: 21.99, AUD: 13.99, BRL: 21.9, CAD: 11.99, CHF: 13.95, CZK: 179,
      DKK: 99, EUR: 11.99, GBP: 12.99, HKD: 58, HUF: 2290, INR: 119,
      JPY: 980, MYR: 17.9, NOK: 129, NZD: 14.99, PLN: 23.99, SEK: 129,
      SGD: 11.98, USD: 11.99,
    },
  },
  {
    name: 'Apple Music', category: 'music', cycle: 'monthly',
    costs: {
      AED: 21.99, AUD: 12.99, BRL: 21.9, CAD: 10.99, CHF: 12.9, CZK: 165,
      DKK: 89, EUR: 11.99, GBP: 10.99, HKD: 58, HUF: 1990, INR: 99,
      JPY: 1080, MYR: 16.9, NOK: 109, NZD: 13.99, PLN: 21.99, SEK: 109,
      SGD: 11.98, USD: 10.99,
    },
  },
  {
    name: 'Adobe Creative Cloud', category: 'software', cycle: 'monthly',
    costs: {
      AED: 259, AUD: 96.99, BRL: 349, CAD: 82.49, CHF: 63.95, CZK: 1599,
      DKK: 519, EUR: 66.99, GBP: 56.98, HKD: 508, HUF: 24990, INR: 4230,
      JPY: 7780, MYR: 289, NOK: 749, NZD: 104.99, PLN: 274.99, SEK: 699,
      SGD: 88.98, USD: 59.99,
    },
  },
  {
    name: 'Figma', category: 'software', cycle: 'monthly',
    costs: {
      AED: 44, AUD: 18, BRL: 65, CAD: 16, CHF: 11, CZK: 279, DKK: 89,
      EUR: 11.99, GBP: 9.99, HKD: 94, HUF: 4290, INR: 1000, JPY: 1800,
      MYR: 56, NOK: 139, NZD: 20, PLN: 49, SEK: 129, SGD: 15.98, USD: 12,
    },
  },
  {
    name: 'GitHub', category: 'software', cycle: 'monthly',
    costs: {
      AED: 15, AUD: 6, BRL: 22, CAD: 5.5, CHF: 3.6, CZK: 92, DKK: 27,
      EUR: 3.99, GBP: 3.49, HKD: 31, HUF: 1450, INR: 340, JPY: 600,
      MYR: 19, NOK: 44, NZD: 6.6, PLN: 16, SEK: 42, SGD: 5.98, USD: 4,
    },
  },
  {
    name: 'Notion', category: 'productivity', cycle: 'monthly',
    costs: {
      AED: 37, AUD: 15, BRL: 54, CAD: 14, CHF: 9, CZK: 230, DKK: 68,
      EUR: 9.99, GBP: 8.99, HKD: 78, HUF: 3600, INR: 850, JPY: 1500,
      MYR: 47, NOK: 110, NZD: 17, PLN: 40, SEK: 105, SGD: 13.98, USD: 10,
    },
  },
  {
    name: 'ChatGPT Plus', category: 'productivity', cycle: 'monthly',
    costs: {
      AED: 75, AUD: 32, BRL: 110, CAD: 29, CHF: 19, CZK: 545, DKK: 155,
      EUR: 22.99, GBP: 18.99, HKD: 156, HUF: 8500, INR: 1999, JPY: 3000,
      MYR: 95, NOK: 245, NZD: 35, PLN: 97, SEK: 235, SGD: 27.98, USD: 20,
    },
  },
  {
    name: 'Dropbox', category: 'cloud', cycle: 'monthly',
    costs: {
      AED: 44, AUD: 18.2, BRL: 65, CAD: 16.3, CHF: 10.75, CZK: 275,
      DKK: 82, EUR: 11.99, GBP: 9.99, HKD: 94, HUF: 4300, INR: 1000,
      JPY: 1800, MYR: 56, NOK: 132, NZD: 19.8, PLN: 48, SEK: 125,
      SGD: 15.98, USD: 11.99,
    },
  },
  {
    name: 'iCloud+', category: 'cloud', cycle: 'monthly',
    costs: {
      AED: 11.99, AUD: 4.49, BRL: 14.9, CAD: 3.99, CHF: 2.95, CZK: 69,
      DKK: 22, EUR: 2.99, GBP: 2.99, HKD: 23, HUF: 1090, INR: 219,
      JPY: 400, MYR: 11.9, NOK: 29, NZD: 4.99, PLN: 12.99, SEK: 29,
      SGD: 4.98, USD: 2.99,
    },
  },
  {
    name: 'Xbox Game Pass', category: 'gaming', cycle: 'monthly',
    costs: {
      AED: 69.99, AUD: 24.95, BRL: 99.9, CAD: 22.99, CHF: 17.9, CZK: 399,
      DKK: 139, EUR: 17.99, GBP: 14.99, HKD: 128, HUF: 6499, INR: 699,
      JPY: 2200, MYR: 65, NOK: 199, NZD: 27.95, PLN: 79.99, SEK: 199,
      SGD: 22.98, USD: 16.99,
    },
  },
  {
    name: 'PlayStation Plus', category: 'gaming', cycle: 'monthly',
    costs: {
      AED: 44.99, AUD: 16.95, BRL: 44.9, CAD: 15.99, CHF: 11.9, CZK: 279,
      DKK: 89, EUR: 13.99, GBP: 10.99, HKD: 78, HUF: 4290, INR: 749,
      JPY: 1300, MYR: 44.9, NOK: 129, NZD: 18.95, PLN: 45, SEK: 129,
      SGD: 18.98, USD: 13.99,
    },
  },
  {
    name: 'Peloton', category: 'fitness', cycle: 'monthly',
    costs: {
      AED: 165, AUD: 59, BRL: 240, CAD: 55, CHF: 39, CZK: 999, DKK: 299,
      EUR: 39.99, GBP: 39, HKD: 345, HUF: 15900, INR: 3700, JPY: 6500,
      MYR: 205, NOK: 469, NZD: 65, PLN: 179, SEK: 449, SGD: 59.98, USD: 44,
    },
  },
  {
    name: 'ClassPass', category: 'fitness', cycle: 'monthly',
    costs: {
      AED: 185, AUD: 69, BRL: 265, CAD: 65, CHF: 45, CZK: 1100, DKK: 339,
      EUR: 45, GBP: 39, HKD: 385, HUF: 17500, INR: 4100, JPY: 7300,
      MYR: 229, NOK: 529, NZD: 75, PLN: 199, SEK: 499, SGD: 65, USD: 49,
    },
  },
];

/**
 * Monthly list price in `currency`, falling back to the USD entry.
 *
 * The fallback is defensive only — every suggestion carries every supported
 * currency, and a test enforces that. It exists so a hand-edit that drops a key
 * can't put "$0.00/mo" in front of a new user. Do not lean on it when adding a
 * currency: a US price under a złoty sign is a worse first impression than the
 * empty field the user would otherwise have filled in themselves.
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
