import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from './storage';

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

/** Device-only for the same reason the token is (lib/storage.ts): a preference
 *  restored onto different hardware describes a device that isn't this one. */
const PREF_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

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
  // The first two say a sensor exists and something is enrolled. This one asks
  // the question that actually matters here — whether SecureStore can arm the
  // gate — because that is a different check underneath (device-owner
  // authentication *with biometrics*, i.e. strong enough to protect a key).
  // Identical to the pair above on iOS today; they diverge on Android, where a
  // class-2 "weak" biometric enrols happily but cannot guard a Keychain item.
  return hasHardware && isEnrolled && SecureStore.canUseBiometricAuthentication();
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
 * `disableDeviceFallback` stays false so this confirmation can be completed with
 * the device passcode after a biometric lockout (~5 failed attempts).
 *
 * That fallback applies to *this call only*. The real gate is the Keychain read
 * in lib/storage.ts, and expo-secure-store hard-codes its access control to
 * `.biometryCurrentSet` — no `.devicePasscode`, and not configurable. So after a
 * biometric lockout the token cannot be read at all until the device itself is
 * unlocked with its passcode, which resets the biometric attempt counter. Do not
 * read the option below as evidence that the gate has a passcode path; it does
 * not, and that is the correct posture for a stored credential.
 */
async function confirm(promptMessage: string): Promise<boolean> {
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
      ? SecureStore.setItemAsync(PREF_PREFIX + userId, '1', PREF_OPTIONS)
      : SecureStore.deleteItemAsync(PREF_PREFIX + userId),
};

/**
 * Whether this user has already been *asked*, which is not the same as whether
 * the feature is on. Declining has to stick, or the prompt becomes nagware; and
 * it is separate from the preference so that turning the feature off later does
 * not re-arm the offer.
 */
const OFFERED_PREFIX = 'biometric_offered_';

export const biometricOffer = {
  seen: async (userId: string): Promise<boolean> =>
    (await SecureStore.getItemAsync(OFFERED_PREFIX + userId)) === '1',
  markSeen: (userId: string): Promise<void> =>
    SecureStore.setItemAsync(OFFERED_PREFIX + userId, '1', PREF_OPTIONS),
};

export type QuickUnlockResult = 'ok' | 'cancelled' | 'no-session' | 'error';

/**
 * The single write path for turning quick-unlock on or off.
 *
 * Both entry points — the Account switch and the post-sign-in offer — go through
 * here so the two halves of the state (the gated token and the stored
 * preference) can never be updated by one and not the other.
 *
 * Confirms *before* enabling, never after: the point is that the user finds out
 * biometrics work now, rather than at next launch when it is the only way in.
 */
export async function setQuickUnlock(
  userId: string,
  enabled: boolean,
  label: BiometricLabel,
): Promise<QuickUnlockResult> {
  try {
    if (enabled && !(await confirm(`Confirm it's you to unlock Paypr with ${label}.`))) {
      return 'cancelled';
    }
    // False means there was no token to move — the session is already gone, and
    // claiming success would leave the preference describing a gate that does
    // not exist.
    if (!(await tokenStorage.setProtected(enabled))) return 'no-session';
    await biometricPref.set(userId, enabled);
    return 'ok';
  } catch {
    return 'error';
  }
}
