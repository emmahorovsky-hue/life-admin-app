import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const SEEN_KEY = 'onboarding_seen';

/**
 * Whether this device has been through onboarding (LIF-218).
 *
 * SecureStore rather than AsyncStorage: it is the module `tokenStorage` already
 * uses, and there is otherwise no key-value store in the tree — not worth
 * adding a dependency for one boolean. Note it is *not* cleared on logout, on
 * purpose: onboarding is per-device, not per-session.
 */
export const onboardingStorage = {
  seen: async () => (await SecureStore.getItemAsync(SEEN_KEY)) === '1',
  markSeen: () => SecureStore.setItemAsync(SEEN_KEY, '1'),
};

/** `seen` is `null` while the flag is still being read — callers must not
 *  redirect on it until it resolves, or first-timers flash the login screen. */
export function useOnboardingSeen() {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    onboardingStorage
      .seen()
      // A SecureStore read that fails shouldn't strand the app on a null gate;
      // treat it as "seen" so the user lands on login rather than nowhere.
      .catch(() => true)
      .then((value) => { if (active) setSeen(value); });
    return () => { active = false; };
  }, []);

  const markSeen = useCallback(async () => {
    await onboardingStorage.markSeen();
    setSeen(true);
  }, []);

  return { seen, markSeen };
}
