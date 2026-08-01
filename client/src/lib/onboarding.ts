// First-run onboarding state (LIF-220). Deliberately client-only: the flow is a
// convenience for an empty account, not a property of the account, so it lives
// in localStorage rather than costing a column and a migration. The consequence
// — a user who signs up on one browser and opens another sees the wizard again
// — is acceptable precisely because the account being empty is the real gate.
// Once a subscription exists, `shouldShowWizard`/`shouldShowResumeCard` return
// false regardless of what is stored here.

export const ONBOARDING_STORAGE_KEY = 'paypr.onboarding.v1';

export type OnboardingStatus = 'pending' | 'skipped' | 'done';
export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingState {
  status: OnboardingStatus;
  /** Step to resume at. Remembered when the user skips part-way through. */
  step: OnboardingStep;
  /** Service names ticked in step 1, so a resumed wizard reopens with them. */
  picks: string[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  status: 'pending',
  step: 1,
  picks: [],
};

const STATUSES: OnboardingStatus[] = ['pending', 'skipped', 'done'];

function isStep(value: unknown): value is OnboardingStep {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Read persisted state, falling back to a pending default. Anything unreadable
 * or malformed degrades to the default rather than throwing: localStorage
 * access itself throws in Safari private mode, and a half-written or
 * hand-edited value must not be able to break the dashboard.
 */
export function readOnboardingState(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_STATE;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_ONBOARDING_STATE;

    const { status, step, picks } = parsed as Partial<OnboardingState>;
    return {
      status: STATUSES.includes(status as OnboardingStatus)
        ? (status as OnboardingStatus)
        : DEFAULT_ONBOARDING_STATE.status,
      step: isStep(step) ? step : DEFAULT_ONBOARDING_STATE.step,
      picks: Array.isArray(picks) ? picks.filter((p): p is string => typeof p === 'string') : [],
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

/** Persist state. A write failure (private mode, quota) is not worth surfacing. */
export function writeOnboardingState(state: OnboardingState): void {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
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
