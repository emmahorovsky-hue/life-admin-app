import { describe, it, expect, beforeEach } from 'vitest';
import {
  ONBOARDING_STORAGE_KEY,
  onboardingStorageKey,
  DEFAULT_ONBOARDING_STATE,
  readOnboardingState,
  writeOnboardingState,
  shouldShowWizard,
  shouldShowResumeCard,
  type OnboardingState,
} from './onboarding';

const skipped: OnboardingState = { status: 'skipped', step: 2, picks: ['Netflix'], created: [] };

const USER = 'user-1';
const OTHER = 'user-2';

/** Seed this user's own key, as a previous session of theirs would have left it. */
const seed = (userId: string, raw: string) =>
  localStorage.setItem(onboardingStorageKey(userId), raw);

describe('onboarding state', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to pending when nothing is stored', () => {
    expect(readOnboardingState(USER)).toEqual(DEFAULT_ONBOARDING_STATE);
  });

  it('round-trips a written state', () => {
    writeOnboardingState(USER, skipped);
    expect(readOnboardingState(USER)).toEqual(skipped);
  });

  // A half-written or hand-edited value must not be able to break the dashboard,
  // so every malformed shape degrades to the default rather than throwing.
  it.each([
    ['invalid JSON', '{not json'],
    ['a non-object', '"a string"'],
    ['an unknown status', '{"status":"banana","step":1,"picks":[]}'],
    ['an out-of-range step', '{"status":"pending","step":9,"picks":[]}'],
  ])('falls back to the default for %s', (_label, raw) => {
    seed(USER, raw);
    expect(readOnboardingState(USER)).toEqual(DEFAULT_ONBOARDING_STATE);
  });

  // States written before `created` existed are still out there in real
  // browsers; they must read back as "nothing known to be created" rather than
  // undefined, which would blow up the Set the wizard seeds from it.
  it('reads a state stored without `created` as an empty list', () => {
    seed(USER, '{"status":"skipped","step":2,"picks":["Netflix"]}');
    expect(readOnboardingState(USER).created).toEqual([]);
  });

  it('drops non-string entries from `created` too', () => {
    seed(USER, '{"status":"skipped","step":2,"picks":[],"created":["Netflix",false,{}]}');
    expect(readOnboardingState(USER).created).toEqual(['Netflix']);
  });

  it('drops non-string picks rather than trusting the stored array', () => {
    seed(USER, '{"status":"skipped","step":1,"picks":["Netflix",7,null]}');
    expect(readOnboardingState(USER).picks).toEqual(['Netflix']);
  });

  // The bug this keying exists to fix (LIF-242): stored per browser, the second
  // account to sign up here read back the first one's `done` and never saw the
  // wizard at all.
  describe('per-account scoping', () => {
    it('does not let one account suppress the wizard for another', () => {
      writeOnboardingState(USER, { ...DEFAULT_ONBOARDING_STATE, status: 'done', step: 3 });

      expect(readOnboardingState(USER).status).toBe('done');
      expect(readOnboardingState(OTHER)).toEqual(DEFAULT_ONBOARDING_STATE);
    });

    it('keeps each account on its own step and picks', () => {
      writeOnboardingState(USER, skipped);
      writeOnboardingState(OTHER, { status: 'skipped', step: 1, picks: ['Spotify'], created: [] });

      expect(readOnboardingState(USER).picks).toEqual(['Netflix']);
      expect(readOnboardingState(OTHER).picks).toEqual(['Spotify']);
    });

    // Not reachable through <ProtectedRoute>, but the fallback must err towards
    // offering the wizard rather than silently swallowing it.
    it('reads as pending and writes nothing without a user', () => {
      writeOnboardingState(undefined, skipped);

      expect(readOnboardingState(undefined)).toEqual(DEFAULT_ONBOARDING_STATE);
      expect(localStorage.length).toBe(0);
    });
  });

  // The browser-wide key predates LIF-242. Adopting it once keeps the user who
  // is already here on the choice they made; deleting it is what stops that
  // choice leaking into the next account to sign up in this browser.
  describe('legacy browser-wide key', () => {
    it('is adopted by the first account to read it, then removed', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(skipped));

      expect(readOnboardingState(USER)).toEqual(skipped);
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
      expect(readOnboardingState(USER)).toEqual(skipped);
    });

    it('does not carry over to the next account', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(skipped));
      readOnboardingState(USER);

      expect(readOnboardingState(OTHER)).toEqual(DEFAULT_ONBOARDING_STATE);
    });

    it("loses to this account's own state", () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(skipped));
      writeOnboardingState(USER, { ...DEFAULT_ONBOARDING_STATE, status: 'done', step: 3 });

      expect(readOnboardingState(USER).status).toBe('done');
    });
  });

  describe('gating', () => {
    it('shows the wizard only for a pending, empty account', () => {
      expect(shouldShowWizard(DEFAULT_ONBOARDING_STATE, false)).toBe(true);
      expect(shouldShowWizard(skipped, false)).toBe(false);
      expect(shouldShowWizard({ ...DEFAULT_ONBOARDING_STATE, status: 'done' }, false)).toBe(false);
    });

    it('shows the resume card only for a skipped, empty account', () => {
      expect(shouldShowResumeCard(skipped, false)).toBe(true);
      expect(shouldShowResumeCard(DEFAULT_ONBOARDING_STATE, false)).toBe(false);
    });

    // The server-side fact wins: a stale `pending` must never re-interrupt a
    // user who has already filed something.
    it('shows neither once the account has subscriptions', () => {
      expect(shouldShowWizard(DEFAULT_ONBOARDING_STATE, true)).toBe(false);
      expect(shouldShowResumeCard(skipped, true)).toBe(false);
    });
  });
});
