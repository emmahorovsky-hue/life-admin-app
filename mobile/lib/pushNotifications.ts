import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

// Token already registered with the server during this app run. Prevents
// duplicate POSTs when auth state re-resolves (e.g. session restore followed
// by a profile refresh) without blocking re-registration after rotation.
let registeredToken: string | null = null;

// Called on logout: if a different user signs in on this device next, the
// server must re-associate the (unchanged) token with the new account, so the
// dedupe cache must not suppress that POST.
export function invalidatePushRegistration(): void {
  registeredToken = null;
}

/**
 * Requests notification permission, obtains the Expo push token and registers
 * it with the server. Requires an authenticated session (Bearer token) — call
 * only after login/session restore.
 *
 * Best-effort by design: permission denial, simulators, offline and server
 * errors all return silently. Push registration must never break login.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    // Push tokens are only issued to physical devices.
    if (!Device.isDevice) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    // Android 13+ requires a channel to exist before the permission prompt.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    // Denied: respect the choice silently — the OS-level prompt is the only ask.
    if (!granted) return;

    // getExpoPushTokenAsync falls back to these same Constants fields, but
    // resolving explicitly documents the dependency on EAS config.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {},
    );

    if (token === registeredToken) return;

    await api.post('/auth/device-token', { token, platform: Platform.OS });
    registeredToken = token;
  } catch {
    // Best-effort: swallow everything (see doc comment above).
  }
}

// Native device tokens can rotate while the app runs; the Expo token derived
// from them changes too. Re-run registration — the dedupe cache skips the POST
// if the Expo token is in fact unchanged.
export function subscribeToPushTokenRotation(): ReturnType<
  typeof Notifications.addPushTokenListener
> {
  return Notifications.addPushTokenListener(() => {
    void registerForPushNotifications();
  });
}
