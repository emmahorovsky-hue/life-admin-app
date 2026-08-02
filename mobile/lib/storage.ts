import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

/**
 * Biometric quick-unlock (LIF-222). When the feature is on the JWT moves to a
 * second Keychain item written with `requireAuthentication`, so the OS itself
 * refuses to return it without Face ID / Touch ID.
 *
 * It gets its own key *and* its own `keychainService`: the SDK 57 docs note that
 * `requireAuthentication` "would not work in tandem with the keychainService
 * value used for the other non-authenticated operations", so the gated item is
 * kept clear of everything else this module stores.
 */
const PROTECTED_TOKEN_KEY = 'auth_token_biometric';
const PROTECTED_SERVICE = 'com.paypr.live.biometric';
const PROTECTED_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainService: PROTECTED_SERVICE,
};

/**
 * Plain marker recording that the token currently lives behind the biometric
 * gate. Read on every cold start, before we know who the user is, so it must
 * NOT itself be protected — checking for the gated item directly would trigger
 * the very prompt we are trying to schedule.
 */
const PROTECTED_FLAG_KEY = 'auth_token_is_protected';

/**
 * The unlocked token, held for the lifetime of the process.
 *
 * This is what makes the feature usable at all: `lib/api.ts` reads the token on
 * *every* request, and reading a `requireAuthentication` item prompts every
 * time. So the protected item is read exactly once — at unlock — and served
 * from here afterwards. Cleared on re-lock and on sign-out.
 */
let cachedToken: string | null = null;

/**
 * In-memory copy of the flag, read from the Keychain at most once per process.
 *
 * Not just an optimisation: `relock()` has to decide whether to raise the gate
 * *synchronously*. Awaiting a Keychain read first leaves a window in which the
 * app has already foregrounded and is painting the user's subscriptions behind
 * a lock screen that has not mounted yet. Null means "not read yet".
 */
let protectedFlag: boolean | null = null;

export const tokenStorage = {
  /**
   * The token for outgoing requests. Never touches the protected item, so it
   * can never prompt: when the gate is on and we are still locked this returns
   * null, which is correct — a locked app has no session to spend.
   */
  get: async (): Promise<string | null> => {
    if (cachedToken) return cachedToken;
    if (await tokenStorage.isProtected()) return null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  set: async (token: string): Promise<void> => {
    cachedToken = token;
    if (await tokenStorage.isProtected()) {
      await SecureStore.setItemAsync(PROTECTED_TOKEN_KEY, token, PROTECTED_OPTIONS);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  /** Clears both copies — the flag is the only thing that says which is live. */
  remove: async (): Promise<void> => {
    cachedToken = null;
    protectedFlag = false;
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(PROTECTED_TOKEN_KEY, { keychainService: PROTECTED_SERVICE }),
      SecureStore.deleteItemAsync(PROTECTED_FLAG_KEY),
    ]);
  },

  isProtected: async (): Promise<boolean> => {
    if (protectedFlag === null) {
      protectedFlag = (await SecureStore.getItemAsync(PROTECTED_FLAG_KEY)) === '1';
    }
    return protectedFlag;
  },

  /**
   * Synchronous view of the same flag, for the one caller that cannot await
   * (`relock`). Reads false until `isProtected()` has run once — which the
   * cold-start path in AuthContext always does, before any re-lock is possible.
   */
  isProtectedNow: (): boolean => protectedFlag === true,

  /**
   * Gated, but not unlocked in this process — so `get()` has nothing to hand
   * out. `lib/api.ts` needs to tell this apart from being signed out: the first
   * means "wait for the lock screen", the second means "there is no session".
   *
   * Synchronous, so it depends on the flag already having been read — call it
   * only after a `get()` that came back null, which is exactly what populates
   * it. Ordering it the other way round would read false on the first request
   * of the process and let a bare call through.
   */
  isLocked: (): boolean => protectedFlag === true && cachedToken === null,

  /**
   * Reads the gated item, prompting for biometrics. The single place a prompt
   * originates. Resolves null when the OS refuses — cancelled, locked out, or
   * the key invalidated by an enrolment change (adding a face or finger makes
   * the item permanently unreadable, by design).
   *
   * Callers must treat null as "stay locked", never as "no session": deleting
   * the token here would turn a cancelled prompt into a silent sign-out.
   */
  unlock: async (): Promise<string | null> => {
    try {
      const token = await SecureStore.getItemAsync(PROTECTED_TOKEN_KEY, PROTECTED_OPTIONS);
      cachedToken = token;
      return token;
    } catch {
      return null;
    }
  },

  /** Drops the in-memory copy without touching storage, so the next read must unlock again. */
  lock: (): void => {
    cachedToken = null;
  },

  /**
   * Moves the existing token between the plain and gated items. Never signs the
   * user out: the token is carried across in memory, and the flag flips only
   * once the new copy is written.
   *
   * Returns false when there is no token to move, which means the caller's
   * session is already gone — the toggle should not claim success.
   */
  setProtected: async (enabled: boolean): Promise<boolean> => {
    const token = cachedToken ?? (await SecureStore.getItemAsync(TOKEN_KEY));
    if (!token) return false;

    if (enabled) {
      await SecureStore.setItemAsync(PROTECTED_TOKEN_KEY, token, PROTECTED_OPTIONS);
      await SecureStore.setItemAsync(PROTECTED_FLAG_KEY, '1');
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.deleteItemAsync(PROTECTED_FLAG_KEY);
      await SecureStore.deleteItemAsync(PROTECTED_TOKEN_KEY, { keychainService: PROTECTED_SERVICE });
    }

    protectedFlag = enabled;
    cachedToken = token;
    return true;
  },
};
