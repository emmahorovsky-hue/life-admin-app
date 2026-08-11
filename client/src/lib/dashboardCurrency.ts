// The currency the dashboard is scoped to (LIF-257). Client-only and per
// account, mirroring the onboarding flag in `lib/onboarding.ts`: it is a view
// preference for this browser, not a property of the account, so it costs no
// column and no migration. Keyed by user for the same reason onboarding is —
// logging out does not clear localStorage, and the next account to sign in here
// must not inherit a currency it may not even hold.
//
// Nothing downstream trusts the stored value: the dashboard only honours it
// while the user still holds that currency, and falls back to their dominant
// one otherwise (deleting the last EUR subscription must not leave the page
// scoped to EUR).

export const DASHBOARD_CURRENCY_STORAGE_KEY = 'paypr.dashboard.currency.v1';

export function dashboardCurrencyStorageKey(userId: string): string {
  return `${DASHBOARD_CURRENCY_STORAGE_KEY}:${userId}`;
}

/**
 * The remembered currency code, or null if there isn't a usable one.
 * localStorage access itself throws in Safari private mode, so an unreadable
 * store reads as "no preference" rather than taking the dashboard with it.
 */
export function readDashboardCurrency(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    const stored = window.localStorage.getItem(dashboardCurrencyStorageKey(userId));
    // A currency code, not arbitrary text: anything else is a hand-edited or
    // half-written value and is discarded.
    return stored && /^[A-Z]{3}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persist the selection. A write failure (private mode, quota) isn't worth surfacing. */
export function writeDashboardCurrency(userId: string | undefined, currency: string): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(dashboardCurrencyStorageKey(userId), currency);
  } catch {
    /* no-op — the choice still holds for this session, it just won't be remembered */
  }
}
