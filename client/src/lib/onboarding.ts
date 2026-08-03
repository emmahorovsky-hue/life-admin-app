// First-run onboarding state (LIF-220). Deliberately client-only: the flow is a
// convenience for an empty account, not a property of the account, so it lives
// in localStorage rather than costing a column and a migration. The consequence
// — a user who signs up on one browser and opens another sees the wizard again
// — is acceptable precisely because the account being empty is the real gate.
// Once a subscription exists, `shouldShowWizard`/`shouldShowResumeCard` return
// false regardless of what is stored here.
//
// Client-side, but **per account, not per browser** (LIF-242). Stored per
// browser it suppressed the wizard for every account after the first one:
// logging out does not clear localStorage, so the second sign-up read back the
// first account's `skipped`/`done` and went straight to the resume card. Keying
// by user is also why logout still leaves the value alone — signing back in as
// the same user should respect the choice they made.

/**
 * The pre-LIF-242 browser-wide key. Still read once per account and then
 * removed, so a user already on this browser keeps whatever they chose rather
 * than being re-interrupted by the upgrade. Also the seam the e2e suite seeds
 * through (`client/e2e/auth.spec.ts`) — it has no user id at
 * `addInitScript` time, so a browser-wide "done" is the only thing it can write.
 */
export const ONBOARDING_STORAGE_KEY = 'paypr.onboarding.v1';

/** Per-account key. `undefined` while auth is still resolving — see the reads below. */
export function onboardingStorageKey(userId: string): string {
  return `${ONBOARDING_STORAGE_KEY}:${userId}`;
}

export type OnboardingStatus = 'pending' | 'skipped' | 'done';
export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingState {
  status: OnboardingStatus;
  /** Step to resume at. Remembered when the user skips part-way through. */
  step: OnboardingStep;
  /** Service names ticked in step 1, so a resumed wizard reopens with them. */
  picks: string[];
  /**
   * Service names already created server-side. Persisted, not just held in the
   * wizard, because the dedupe has to survive the wizard unmounting: a partial
   * failure followed by skip → resume would otherwise re-send the rows that
   * already landed and leave the user with duplicates.
   */
  created: string[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  status: 'pending',
  step: 1,
  picks: [],
  created: [],
};

const STATUSES: OnboardingStatus[] = ['pending', 'skipped', 'done'];

function isStep(value: unknown): value is OnboardingStep {
  return value === 1 || value === 2 || value === 3;
}

/** Keep only the string entries of a stored array; anything else is discarded. */
function stringsOnly(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Anything malformed reads as the pending default rather than throwing: a
 *  half-written or hand-edited value must not be able to break the dashboard. */
function parseOnboardingState(raw: string | null): OnboardingState | null {
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_ONBOARDING_STATE;

  const { status, step, picks, created } = parsed as Partial<OnboardingState>;
  return {
    status: STATUSES.includes(status as OnboardingStatus)
      ? (status as OnboardingStatus)
      : DEFAULT_ONBOARDING_STATE.status,
    step: isStep(step) ? step : DEFAULT_ONBOARDING_STATE.step,
    picks: stringsOnly(picks),
    // Absent in states written before `created` existed — an empty list is
    // the right reading of those: nothing is known to have been created.
    created: stringsOnly(created),
  };
}

/**
 * Read this user's persisted state, falling back to a pending default.
 * localStorage access itself throws in Safari private mode, so an unreadable
 * store degrades to the default rather than taking the dashboard with it.
 *
 * Absent a per-user value, the browser-wide key written before LIF-242 is
 * adopted once and removed. Deleting it is what makes the next account in this
 * browser start clean; leaving it would reproduce the bug for every account
 * after this one.
 *
 * `userId` is undefined only if this is somehow reached before auth resolves,
 * which `<ProtectedRoute>` already prevents for the dashboard. The default it
 * returns is `pending`, so the fallback errs towards offering the wizard rather
 * than silently swallowing it — the failure this whole change is about.
 */
export function readOnboardingState(userId: string | undefined): OnboardingState {
  if (!userId) return DEFAULT_ONBOARDING_STATE;

  try {
    const mine = parseOnboardingState(window.localStorage.getItem(onboardingStorageKey(userId)));
    if (mine) return mine;

    const legacy = parseOnboardingState(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
    if (!legacy) return DEFAULT_ONBOARDING_STATE;

    writeOnboardingState(userId, legacy);
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    return legacy;
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

/** Persist state. A write failure (private mode, quota) is not worth surfacing. */
export function writeOnboardingState(userId: string | undefined, state: OnboardingState): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(onboardingStorageKey(userId), JSON.stringify(state));
  } catch {
    /* no-op — the flow still works for this session, it just won't be remembered */
  }
}

/**
 * The wizard opens only on a genuinely empty account that has neither finished
 * nor dismissed the flow. `hasSubscriptions` is the authoritative half: it
 * comes from the server, so a stale `pending` can never re-interrupt a user who
 * has already filed something.
 */
export function shouldShowWizard(state: OnboardingState, hasSubscriptions: boolean): boolean {
  return !hasSubscriptions && state.status === 'pending';
}

/** The resume strip stands in for the wizard once it has been skipped. */
export function shouldShowResumeCard(state: OnboardingState, hasSubscriptions: boolean): boolean {
  return !hasSubscriptions && state.status === 'skipped';
}
