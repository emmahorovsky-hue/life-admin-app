import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { api } from './api';

// Expo token already registered with the server during this app run. Prevents
// duplicate POSTs when auth state re-resolves (e.g. session restore followed
// by a profile refresh) without blocking re-registration after rotation.
let registeredToken: string | null = null;

// A registration already running. Every entry point joins it instead of
// starting a second one — see the loop note on `subscribeToPushTokenRotation`.
let inFlight: Promise<void> | null = null;

// When the last attempt started, and how many have failed back to back since
// the last success. Together these cap the retry rate (see MIN_RETRY_INTERVAL_MS).
let lastAttemptAt = 0;
let consecutiveFailures = 0;

// The most recent device token the rotation listener has seen. A rotation event
// carrying a token we have not seen is real news and skips the throttle; one
// carrying the token we already hold is an echo of our own token fetch and must
// not.
let lastDeviceTokenData: string | null = null;

// A registration attempt costs a network round trip to Expo plus one to our
// API, and nothing about it is urgent: the token is already valid on the device
// and the server only needs it before the next reminder goes out. So attempts
// are capped at one per minute no matter what asks for them. This is a ceiling,
// not a schedule — the guards above mean the steady state is one POST per app
// run.
const MIN_RETRY_INTERVAL_MS = 60_000;

// Failing to register is normal once (offline, Expo hiccup) and a bug when it
// keeps happening. Report at the point it stops looking like weather.
const FAILURES_BEFORE_REPORT = 3;

// Called on logout: if a different user signs in on this device next, the
// server must re-associate the (unchanged) token with the new account, so the
// dedupe cache must not suppress that POST — nor may the retry throttle delay
// it, since a sign-in is a deliberate act, not a retry.
export function invalidatePushRegistration(): void {
  registeredToken = null;
  lastAttemptAt = 0;
  consecutiveFailures = 0;
}

/**
 * Requests notification permission, obtains the Expo push token and registers
 * it with the server. Requires an authenticated session (Bearer token) — call
 * only after login/session restore.
 *
 * `devicePushToken` is supplied by the rotation listener, which already has the
 * new token; passing it through is what keeps this off the native code path
 * (see `subscribeToPushTokenRotation`). Omitted elsewhere, so the first call of
 * an app run resolves the token itself.
 *
 * Best-effort by design: permission denial, simulators, offline and server
 * errors all return silently. Push registration must never break login.
 */
export function registerForPushNotifications(
  devicePushToken?: Notifications.DevicePushToken,
): Promise<void> {
  // All three guards run before anything async, so a re-entrant call started by
  // the native layer during our own token fetch is answered from memory and
  // never reaches expo-notifications a second time.
  const incoming = deviceTokenData(devicePushToken);
  const rotated = incoming !== null && incoming !== lastDeviceTokenData;
  if (incoming !== null) lastDeviceTokenData = incoming;

  if (inFlight) return inFlight;
  // A real rotation invalidates the token the server holds, so it goes through
  // regardless of when the last attempt was — it is bounded by how often the
  // push service actually rolls a token, which is rare. Everything else waits.
  if (!rotated && Date.now() - lastAttemptAt < MIN_RETRY_INTERVAL_MS) return Promise.resolve();

  lastAttemptAt = Date.now();
  const run = register(devicePushToken).finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

// `data` is a string on iOS/Android and an object on web (which never reaches
// here), so normalise before comparing.
function deviceTokenData(token?: Notifications.DevicePushToken): string | null {
  if (!token) return null;
  return typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
}

async function register(devicePushToken?: Notifications.DevicePushToken): Promise<void> {
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
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
      // Given a token, expo-notifications derives the Expo token from it
      // instead of calling getDevicePushTokenAsync.
      ...(devicePushToken ? { devicePushToken } : {}),
    });

    if (token === registeredToken) return;

    await api.post('/auth/device-token', { token, platform: Platform.OS });
    registeredToken = token;
    consecutiveFailures = 0;
    Sentry.addBreadcrumb({ category: 'push', level: 'info', message: 'device token registered' });
  } catch (error) {
    // Best-effort: never rethrow (see doc comment above). Reporting is what was
    // missing — a silent catch here hid a registration loop that spent a user's
    // entire API rate-limit budget and 429'd unrelated screens.
    consecutiveFailures += 1;
    if (consecutiveFailures === FAILURES_BEFORE_REPORT) {
      Sentry.captureException(error, {
        level: 'warning',
        tags: { feature: 'push-registration' },
        extra: { consecutiveFailures, fromRotationListener: Boolean(devicePushToken) },
      });
    }
  }
}

/**
 * Native device tokens can rotate while the app runs; the Expo token derived
 * from them changes too. Re-run registration with the token the event carries.
 *
 * Passing it through is not an optimisation — it is the whole point. Fetching
 * the token inside this callback instead re-enters the native layer, which
 * emits another rotation event, which calls this again: expo-notifications
 * warns about exactly that ("you should not call getDevicePushTokenAsync inside
 * this function, as it triggers the listener and may lead to an infinite
 * loop"), and getExpoPushTokenAsync reaches it too when given no token. In
 * production that loop ran at up to 400 requests/second.
 */
export function subscribeToPushTokenRotation(): ReturnType<
  typeof Notifications.addPushTokenListener
> {
  return Notifications.addPushTokenListener((token) => {
    void registerForPushNotifications(token);
  });
}
