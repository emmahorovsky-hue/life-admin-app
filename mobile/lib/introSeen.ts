import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const SEEN_KEY = 'onboarding_seen';

/**
 * Whether this device has been through the logged-out intro carousel (LIF-218).
 *
 * The module was `lib/onboarding.ts` until LIF-224, which needed that name for
 * the first-run *setup* flow — a different thing entirely: three steps, after
 * signup, on an empty dashboard. This one is three photo slides, before signup,
 * once per device. The stored key keeps its original spelling so devices that
 * have already seen the carousel are not shown it again.
 *
 * SecureStore rather than AsyncStorage: it is the module `tokenStorage` already
 * uses, and there is otherwise no key-value store in the tree — not worth
 * adding a dependency for one boolean. Note it is *not* cleared on logout, on
 * purpose: the intro is per-device, not per-session.
 */
export const introStorage = {
  seen: async () => (await SecureStore.getItemAsync(SEEN_KEY)) === '1',
  markSeen: () => SecureStore.setItemAsync(SEEN_KEY, '1'),
};

// The read starts at import, not on first mount, and its result is cached for
// every later mount. `app/(app)/_layout.tsx` renders nothing until the flag
// resolves, while the native splash is dismissed as soon as auth and fonts do —
// a read that only starts when that layout mounts lands after the splash is
// already gone, showing an empty Snow screen for as long as the keychain takes.
// Started here it has the whole of auth to settle in.
//
// A read that fails shouldn't strand the app on a null gate: treat it as "seen"
// so the user lands on login rather than nowhere.
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function readSeen(): Promise<boolean> {
  inflight ??= introStorage
    .seen()
    .catch(() => true)
    .then((value) => (cached = value));
  return inflight;
}

readSeen();

/** `seen` is `null` only until the flag resolves — callers must not redirect on
 *  it before then, or first-timers flash the login screen. */
export function useIntroSeen() {
  const [seen, setSeen] = useState<boolean | null>(cached);

  useEffect(() => {
    if (seen !== null) return;
    let active = true;
    readSeen().then((value) => { if (active) setSeen(value); });
    return () => { active = false; };
  }, [seen]);

  // Rejects if the write fails — callers that navigate on the way out must not
  // let that stop them (see `leave` in app/(auth)/onboarding.tsx). The cache is
  // updated either way: a lost write only costs the user a repeat of the intro
  // on the next launch, and within this launch it must not repeat at all.
  const markSeen = useCallback(async () => {
    cached = true;
    inflight = Promise.resolve(true);
    setSeen(true);
    await introStorage.markSeen();
  }, []);

  return { seen, markSeen };
}
