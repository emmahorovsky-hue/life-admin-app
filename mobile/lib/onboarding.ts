// First-run setup state (LIF-224) — the mobile half of the web wizard shipped
// in LIF-220. Deliberately client-only: the flow is a convenience for an empty
// account, not a property of the account, so it costs no column and no
// migration. It cannot share the web key either — `localStorage` and a keychain
// item have nothing in common — so a user who set up on web and then installs
// the app would be offered it again if this were the only gate. It isn't:
// `shouldShowSetup`/`shouldShowResumeRow` also take `hasSubscriptions`, which
// comes from the server, and that is what actually settles it. Same as web.
//
// Client-side, but **per account, not per device** (LIF-242). Stored per device
// it suppressed the flow for every account after the first one on a phone: the
// key outlives the session — nothing in `clearSession` removes it — so the
// second sign-up read back the first account's `skipped`/`done` and went
// straight to the resume row. Worse on iOS than it sounds, because a keychain
// item survives deleting the app, so reinstalling to re-test did not clear it
// either. Keying by user is what fixes it, and it is also why logout
// deliberately leaves the value alone: signing back in as the same user should
// still respect the choice they made. Same shape as the "already offered"
// flag in lib/biometrics.ts, which had this right from the start.
//
// Not to be confused with the logged-out photo carousel (app/(auth)/onboarding.tsx),
// which is shown on every launch and keeps no per-device flag of its own.

import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// SecureStore rather than AsyncStorage because it's the store already in the
// tree (tokenStorage uses it), and none of this is worth a new dependency.
//
// Underscore-suffixed, not colon-suffixed: SecureStore validates keys against
// `/^[\w.-]+$/` and throws on anything else. Both accessors swallow their
// errors, so a colon here would not crash — it would just never persist, and
// the sheet would reopen on every launch. `biometric_offered_` next door uses
// the same separator for the same reason.
const SETUP_KEY_PREFIX = 'first_run_setup_v1_';

/**
 * The pre-LIF-242 device-wide key. Read once per account and then deleted, so
 * the one user who is already on this device keeps whatever they chose instead
 * of being re-interrupted by an upgrade. Whoever signs up next gets a clean
 * default, which is the entire point.
 */
const LEGACY_SETUP_KEY = 'first_run_setup_v1';

export type SetupStatus = 'pending' | 'skipped' | 'done';
export type SetupStep = 1 | 2 | 3;

export interface SetupState {
  status: SetupStatus;
  /** Step to resume at. Remembered when the user skips part-way through. */
  step: SetupStep;
  /** Service names ticked in step 1, so a resumed sheet reopens with them. */
  picks: string[];
  /**
   * Service names already created server-side. Persisted, not just held in the
   * sheet, because the dedupe has to survive the sheet being dismissed: a
   * partial failure followed by skip → resume would otherwise re-send the rows
   * that already landed and leave the user with duplicates (LIF-220 learned
   * this the hard way — see commit aa96da0).
   */
  created: string[];
}

export const DEFAULT_SETUP_STATE: SetupState = {
  status: 'pending',
  step: 1,
  picks: [],
  created: [],
};

const STATUSES: SetupStatus[] = ['pending', 'skipped', 'done'];

function isStep(value: unknown): value is SetupStep {
  return value === 1 || value === 2 || value === 3;
}

/** Keep only the string entries of a stored array; anything else is discarded. */
function stringsOnly(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Anything malformed reads as the pending default rather than throwing: a
 *  half-written value must not be able to break the dashboard. */
function parseSetupState(raw: string | null): SetupState | null {
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETUP_STATE;

  const { status, step, picks, created } = parsed as Partial<SetupState>;
  return {
    status: STATUSES.includes(status as SetupStatus)
      ? (status as SetupStatus)
      : DEFAULT_SETUP_STATE.status,
    step: isStep(step) ? step : DEFAULT_SETUP_STATE.step,
    picks: stringsOnly(picks),
    created: stringsOnly(created),
  };
}

/**
 * Read this user's persisted state, falling back to a pending default. Anything
 * unreadable degrades to the default rather than throwing — a keychain read can
 * fail, and the dashboard behind this must still come up.
 *
 * Absent a per-user value, the device-wide key written before LIF-242 is
 * adopted once and removed. Deleting it is what makes the next account on this
 * device start clean; leaving it would reproduce the bug for every account
 * after this one.
 */
export async function readSetupState(userId: string): Promise<SetupState> {
  try {
    const mine = parseSetupState(await SecureStore.getItemAsync(SETUP_KEY_PREFIX + userId));
    if (mine) return mine;

    const legacy = parseSetupState(await SecureStore.getItemAsync(LEGACY_SETUP_KEY));
    if (!legacy) return DEFAULT_SETUP_STATE;

    await writeSetupState(userId, legacy);
    await SecureStore.deleteItemAsync(LEGACY_SETUP_KEY);
    return legacy;
  } catch {
    return DEFAULT_SETUP_STATE;
  }
}

/** Persist state. A write failure is not worth surfacing — the flow still works
 *  for this session, it just won't be remembered. */
export async function writeSetupState(userId: string, state: SetupState): Promise<void> {
  try {
    await SecureStore.setItemAsync(SETUP_KEY_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* no-op */
  }
}

/**
 * The sheet opens only on a genuinely empty account that has neither finished
 * nor dismissed the flow. `hasSubscriptions` is the authoritative half: it comes
 * from the server, so a stale `pending` can never re-interrupt a user who has
 * already filed something — on this device or any other.
 */
export function shouldShowSetup(state: SetupState, hasSubscriptions: boolean): boolean {
  return !hasSubscriptions && state.status === 'pending';
}

/** The resume row stands in for the sheet once it has been skipped. */
export function shouldShowResumeRow(state: SetupState, hasSubscriptions: boolean): boolean {
  return !hasSubscriptions && state.status === 'skipped';
}

/**
 * Load this user's persisted state and hand back a setter that writes it
 * through. `state` is `null` until the read resolves — callers must not decide
 * whether to offer setup before then, or an account that already skipped gets
 * the sheet again on every launch.
 *
 * `userId` is undefined for the moment between mount and auth resolving, and
 * `state` stays null across it for exactly the same reason: reading the wrong
 * account's state is no better than reading none.
 */
export function useSetupState(userId: string | undefined) {
  const [state, setState] = useState<SetupState | null>(null);

  /**
   * Re-read from storage. The setup screen writes the outcome itself and then
   * pops, so whoever offered it holds a stale copy until this runs — the
   * dashboard calls it on focus, which is the moment it gets the screen back.
   */
  const refresh = useCallback(async () => {
    if (!userId) return;
    setState(await readSetupState(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      // Signing out mid-session must not leave the previous account's state
      // behind for whoever signs in next.
      setState(null);
      return;
    }
    let active = true;
    readSetupState(userId).then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // Local state moves first so the UI never waits on the keychain; the write is
  // fire-and-forget for the same reason writeSetupState swallows failures.
  const updateState = useCallback(
    (next: SetupState) => {
      setState(next);
      if (userId) void writeSetupState(userId, next);
    },
    [userId],
  );

  return { state, updateState, refresh };
}
