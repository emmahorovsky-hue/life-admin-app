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

const skipped: OnboardingState = { status: 'skipped', step: 2, picks: ['Netflix'] };

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
