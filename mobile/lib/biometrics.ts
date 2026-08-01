import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Face ID / Touch ID quick-unlock (LIF-222).
 *
 * `expo-local-authentication` is used for *capability* here — is there hardware,
 * is anything enrolled, what is it called — and for the one-off confirmation
 * when the user switches the feature on.
 *
 * It is deliberately NOT used to guard the session on launch. The actual gate is
 * SecureStore's own `requireAuthentication`, which makes the OS refuse to hand
 * back the token without biometrics (see lib/storage.ts). Calling
 * `authenticateAsync()` *and* reading a protected item would prompt twice for
 * one unlock, and the `authenticateAsync()` half would be decorative — it
 * returns a boolean the app could ignore, whereas the Keychain gate is enforced
 * below us.
 */

/** Per-user opt-in. Plain storage: it must be readable without a prompt. */
const PREF_PREFIX = 'biometric_pref_';

export type BiometricLabel = 'Face ID' | 'Touch ID' | 'biometrics';

/**
 * Whether the toggle should be offered at all. Hardware alone is not enough —
 * a device with a sensor but nothing enrolled cannot authenticate, and offering
 * a switch that silently fails is worse than hiding it.
 */
export async function isAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/**
 * What to call it in copy. Apple is particular about this: a Touch ID device
 * must not be told to "use Face ID". Falls back to the generic word when the
 * device reports something else (iris is Android-only) or reports nothing.
 */
export async function getLabel(): Promise<BiometricLabel> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
  return 'biometrics';
}

/**
 * One-off check used when enabling the feature, so a user finds out it works
 * *now* rather than at next launch when it is the only way in.
 *
 * `disableDeviceFallback` stays false on purpose: iOS locks biometrics out
 * entirely after ~5 failed attempts, and without the passcode path there would
 * be no way through.
 */
export async function confirm(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  return result.success;
}

/**
 * The opt-in preference, keyed by user id so two accounts on one device do not
 * inherit each other's setting. This is only the *stated* preference — whether
 * the stored token is actually protected right now is tracked separately in
 * lib/storage.ts, because that has to be readable before we know who the user
 * is (see the cold-start path in AuthContext).
 */
export const biometricPref = {
  get: async (userId: string): Promise<boolean> =>
    (await SecureStore.getItemAsync(PREF_PREFIX + userId)) === '1',
  set: (userId: string, enabled: boolean): Promise<void> =>
    enabled
      ? SecureStore.setItemAsync(PREF_PREFIX + userId, '1')
      : SecureStore.deleteItemAsync(PREF_PREFIX + userId),
};
