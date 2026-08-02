import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getLabel, type BiometricLabel } from '../lib/biometrics';
import { colors } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';
import { Wordmark } from './Wordmark';
import { AppText, Button } from './ui';

/**
 * The locked state for biometric quick-unlock (LIF-222).
 *
 * Wears the BrandSplash lockup so the app looks like itself rather than like an
 * error, but static: BrandSplash's stamp is a launch moment, and replaying it
 * every time the user comes back from another app would wear thin fast.
 *
 * Rendered from the root layout rather than inside `(app)`, so it covers
 * whatever route the router restored and nothing authenticated can paint behind
 * it. Cancelling leaves the user here — there is deliberately no path onward
 * except unlocking or signing out.
 *
 * A `Modal`, not a plain absolute fill, because `AppDialog` is one too: an RN
 * Modal presents its own view controller, which no `zIndex` in the root view can
 * outrank. As a sibling `View` this screen appeared *underneath* any open
 * dialog — open one in Settings, background the app past the grace period, and
 * the dialog came back interactive on top of the lock. `onRequestClose` is a
 * deliberate no-op: Android's back button must not dismiss the gate.
 */
export function BiometricLockScreen() {
  const { unlock, logout } = useAuth();
  const [label, setLabel] = useState<BiometricLabel>('biometrics');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void getLabel().then((next) => { if (isMounted) setLabel(next); });
    return () => { isMounted = false; };
  }, []);

  const attempt = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await unlock();
      // Not an error state on its own — a cancelled prompt is a deliberate act.
      // But it is the only feedback the user gets, so the copy has to offer the
      // way out (enrolment changes make the item permanently unreadable, and
      // signing in again is the only fix).
      setFailed(!ok);
    } finally {
      setBusy(false);
    }
  }, [unlock]);

  // Prompt once when the lock screen appears, so the common case is a single
  // glance rather than a tap then a glance. The ref stops React 19's double
  // effect invocation in development from firing two prompts.
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void attempt();
  }, [attempt]);

  // iOS suspends the biometric prompt when the app leaves the foreground; if the
  // user switches away mid-prompt and returns, there is nothing on screen. Retry
  // on the way back so they are not left staring at a dead lock screen.
  //
  // Only from 'background', never from 'inactive'. Presenting the biometric
  // prompt itself resigns active, so retrying on any transition to 'active'
  // would re-prompt the instant the user cancels — and since cancelling is how
  // you get *to* the "Sign out" button, that is a loop with no way out of the
  // app. `busy` alone does not cover it: whether it has been cleared by the
  // time the 'active' event lands is a race.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const previous = appState.current;
      appState.current = state;
      if (state === 'active' && previous === 'background' && !busy) void attempt();
    });
    return () => sub.remove();
  }, [attempt, busy]);

  return (
    <Modal visible animationType="none" onRequestClose={() => {}}>
      <View style={styles.screen}>
        <Wordmark size={44} />
        <View style={styles.rule} />

        <AppText variant="footnote" style={styles.message}>
          {failed
            ? `Paypr is locked. Unlock with ${label}, or sign in again with your password.`
            : `Paypr is locked. Unlock with ${label} to continue.`}
        </AppText>

        <Button
          title={busy ? 'Unlocking…' : `Unlock with ${label}`}
          onPress={attempt}
          loading={busy}
          style={styles.action}
        />
        <Button title="Sign out" variant="outline" onPress={logout} style={styles.action} />

        {/* Only after a failure, because that is when it might be true. Signing
            out revokes the session on the server — but doing so needs the token,
            and the token is behind the gate that just refused. Adding a face or
            finger invalidates the Keychain item permanently, so in that case the
            sign-out is local only and the session stays live elsewhere until it
            expires. Better to say so than to imply an account-wide revoke that
            did not happen (LIF-174). */}
        {failed && (
          <AppText variant="caption" style={styles.caveat}>
            If {label} has stopped working entirely, signing out here only clears this device.
            Sign out at paypr.live to end sessions everywhere.
          </AppText>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fills the Modal's own view controller, so no absolute positioning or zIndex
  // is needed — being a Modal at all is what puts it above everything.
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PAD,
  },
  rule: { width: 104, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 24 },
  message: {
    marginTop: 20,
    marginBottom: 28,
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  action: { alignSelf: 'stretch', marginTop: 10 },
  caveat: {
    marginTop: 20,
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 16,
    color: colors.softMuted,
  },
});
