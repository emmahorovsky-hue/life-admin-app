import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';

/**
 * Whether the OS currently lets this app deliver notifications.
 *
 * `null` until the first read resolves, so a caller can tell "not known yet"
 * from "denied" and avoid flashing a blocked state on mount.
 *
 * Re-read on every focus, not just on mount: the only way to grant permission
 * after a denial is the system Settings app, and coming back from it is exactly
 * a focus event. Without this a screen keeps claiming push is blocked until the
 * app is restarted.
 *
 * A failed read reports `true` rather than blanking the screen — the server-side
 * toggle still means something, and a permissions API that throws is no reason
 * to tell the user their notifications are blocked.
 *
 * Shared by Settings › Notifications and first-run setup step 3, which show the
 * same push control and must not drift on when it is usable.
 */
export function usePushPermission(): boolean | null {
  const [granted, setGranted] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Notifications.getPermissionsAsync()
        .then(({ granted: isGranted }) => { if (active) setGranted(isGranted); })
        .catch(() => { if (active) setGranted(true); });
      return () => { active = false; };
    }, [])
  );

  return granted;
}
