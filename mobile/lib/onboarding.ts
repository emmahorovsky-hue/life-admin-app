// First-run setup state (LIF-224) — the mobile half of the web wizard shipped
// in LIF-220. Deliberately device-only: the flow is a convenience for an empty
// account, not a property of the account, so it costs no column and no
// migration. It cannot share the web key either — `localStorage` and a keychain
// item have nothing in common — so a user who set up on web and then installs
// the app would be offered it again if this were the only gate. It isn't:
// `shouldShowSetup`/`shouldShowResumeRow` also take `hasSubscriptions`, which
// comes from the server, and that is what actually settles it. Same as web.
//
// Not to be confused with lib/introSeen.ts — the logged-out photo carousel.

import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// SecureStore rather than AsyncStorage for the same reason introSeen gives:
// it's the store already in the tree, and none of this is worth a dependency.
const SETUP_KEY = 'first_run_setup_v1';

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

/**
 * Read persisted state, falling back to a pending default. Anything unreadable
 * or malformed degrades to the default rather than throwing: a keychain read
 * can fail, and a half-written value must not be able to break the dashboard.
 */
export async function readSetupState(): Promise<SetupState> {
  try {
    const raw = await SecureStore.getItemAsync(SETUP_KEY);
    if (!raw) return DEFAULT_SETUP_STATE;

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
  } catch {
    return DEFAULT_SETUP_STATE;
  }
}

/** Persist state. A write failure is not worth surfacing — the flow still works
 *  for this session, it just won't be remembered. */
export async function writeSetupState(state: SetupState): Promise<void> {
  try {
    await SecureStore.setItemAsync(SETUP_KEY, JSON.stringify(state));
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
 * Load the persisted state and hand back a setter that writes it through.
 * `state` is `null` until the read resolves — callers must not decide whether to
 * offer setup before then, or an account that already skipped gets the sheet
 * again on every launch.
 */
export function useSetupState() {
  const [state, setState] = useState<SetupState | null>(null);

  useEffect(() => {
    let active = true;
    readSetupState().then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
    };
  }, []);

  // Local state moves first so the UI never waits on the keychain; the write is
  // fire-and-forget for the same reason writeSetupState swallows failures.
  const updateState = useCallback((next: SetupState) => {
    setState(next);
    void writeSetupState(next);
  }, []);

  return { state, updateState };
}
