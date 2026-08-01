import { describe, it, expect, beforeEach } from 'vitest';
import {
  ONBOARDING_STORAGE_KEY,
  DEFAULT_ONBOARDING_STATE,
  readOnboardingState,
  writeOnboardingState,
  shouldShowWizard,
  shouldShowResumeCard,
  type OnboardingState,
} from './onboarding';

const skipped: OnboardingState = { status: 'skipped', step: 2, picks: ['Netflix'], created: [] };

describe('onboarding state', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to pending when nothing is stored', () => {
    expect(readOnboardingState()).toEqual(DEFAULT_ONBOARDING_STATE);
  });

  it('round-trips a written state', () => {
    writeOnboardingState(skipped);
    expect(readOnboardingState()).toEqual(skipped);
  });

  // A half-written or hand-edited value must not be able to break the dashboard,
  // so every malformed shape degrades to the default rather than throwing.
  it.each([
    ['invalid JSON', '{not json'],
    ['a non-object', '"a string"'],
    ['an unknown status', '{"status":"banana","step":1,"picks":[]}'],
    ['an out-of-range step', '{"status":"pending","step":9,"picks":[]}'],
  ])('falls back to the default for %s', (_label, raw) => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, raw);
    expect(readOnboardingState()).toEqual(DEFAULT_ONBOARDING_STATE);
  });

  // States written before `created` existed are still out there in real
  // browsers; they must read back as "nothing known to be created" rather than
  // undefined, which would blow up the Set the wizard seeds from it.
  it('reads a state stored without `created` as an empty list', () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      '{"status":"skipped","step":2,"picks":["Netflix"]}'
    );
    expect(readOnboardingState().created).toEqual([]);
  });

  it('drops non-string entries from `created` too', () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      '{"status":"skipped","step":2,"picks":[],"created":["Netflix",false,{}]}'
    );
    expect(readOnboardingState().created).toEqual(['Netflix']);
  });

  it('drops non-string picks rather than trusting the stored array', () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      '{"status":"skipped","step":1,"picks":["Netflix",7,null]}'
    );
    expect(readOnboardingState().picks).toEqual(['Netflix']);
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
