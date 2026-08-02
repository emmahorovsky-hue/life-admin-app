import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Whether the app is currently the active foreground app.
 *
 * Exists for one job: hiding content before iOS photographs the app for the
 * switcher. The root layout draws `PrivacyCover` over the whole screen, but a
 * React Native `<Modal>` presents its own view controller and is therefore
 * *outside* that cover — so anything inside one has to opt out itself.
 *
 * Deliberately keyed on `!== 'active'` rather than `=== 'background'`: iOS takes
 * the snapshot on the way through 'inactive', so waiting for 'background' is
 * already too late.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return active;
}
