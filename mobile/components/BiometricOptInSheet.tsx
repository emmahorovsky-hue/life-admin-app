import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../contexts/AuthContext';
import {
  biometricOffer,
  getLabel,
  isAvailable,
  setQuickUnlock,
  type BiometricLabel,
} from '../lib/biometrics';
import { colors } from '../lib/theme';
import { AppText, Button, FormSheet, useToast, type FormSheetHandle } from './ui';

/**
 * Offers biometric quick-unlock once, just after the user first gets a session
 * (LIF-222 follow-up).
 *
 * Until now the only way to find the feature was Settings → Account, which
 * meant almost nobody did. This is the discovery surface; the Account switch
 * remains the place to change it later.
 *
 * Three reasons it is here and not in the flows it sits near:
 *
 * - **Not the logged-out carousel.** Enabling gates the *stored token*, and
 *   there is no token until the user has signed in — `setProtected` would return
 *   false and the offer would be a lie.
 * - **Not a fourth step in `FirstRunSetupSheet`.** That sheet only presents on
 *   an empty dashboard, so anyone who added a subscription first would never be
 *   offered this. A security setting must not depend on having no data.
 * - **Gated on `canOffer`** rather than presenting itself. The dashboard owns
 *   the two signals that decide whether the first-run setup sheet is going up
 *   (the persisted setup state and, authoritatively, whether the account has
 *   subscriptions), so it is the only place that can tell these two sheets not
 *   to fight for the same moment.
 */
export function BiometricOptInSheet({ canOffer }: { canOffer: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const sheetRef = useRef<FormSheetHandle>(null);
  const [label, setLabel] = useState<BiometricLabel>('Face ID');
  const [saving, setSaving] = useState(false);

  // One offer per mount, like the first-run sheet — re-presenting on every
  // dependency change would fight the user's dismissal.
  const offered = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    // iOS only, matching the rest of the feature: SecureStore's
    // `requireAuthentication` has not been verified on Android here, and
    // offering a switch that silently fails is worse than not offering it.
    if (Platform.OS !== 'ios' || !userId || offered.current || !canOffer) return;

    let isMounted = true;
    void (async () => {
      const [can, name, seen] = await Promise.all([
        isAvailable(),
        getLabel(),
        biometricOffer.seen(userId),
      ]);
      if (!isMounted || !can || seen) return;
      // Claimed before the next await, not after: two runs of this effect can
      // both get past the guard above while the first is still awaiting, and the
      // second would present a sheet that is already up. Nothing below re-checks
      // it, so it has to be taken here.
      offered.current = true;
      // Marked seen on *presentation*, not on the answer. Declining and killing
      // the app mid-prompt are the same intent as far as the next launch is
      // concerned: do not ask again.
      await biometricOffer.markSeen(userId);
      if (!isMounted) return;
      setLabel(name);
      sheetRef.current?.open();
    })();
    return () => { isMounted = false; };
  }, [userId, canOffer]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const result = await setQuickUnlock(userId, true, label);
      if (result === 'cancelled') return; // stay open; they may want to retry
      sheetRef.current?.close();
      if (result === 'ok') toast.success(`${label} unlock is on.`);
      else if (result === 'no-session') toast.error('Please sign in again to turn this on.');
      else toast.error('Could not turn that on. You can try again in Settings.');
    } finally {
      setSaving(false);
    }
  }, [userId, label, toast]);

  return (
    <FormSheet
      ref={sheetRef}
      // A statement, not the question this used to ask: FormSheet's titles all
      // end in the brand period, and "Unlock with Face ID?." does not read.
      title={`Unlock with ${label}`}
      accessibilityLabel={`Unlock with ${label}`}
      actions={
        <>
          <Button title={`Use ${label}`} onPress={enable} loading={saving} />
          <Button
            title="Not now"
            variant="outline"
            onPress={() => sheetRef.current?.close()}
            disabled={saving}
          />
        </>
      }
    >
      <AppText variant="body" style={styles.body}>
        Skip typing your password when you come back. Paypr stays locked until
        it recognises you, so an unlocked phone is not an open file.
      </AppText>
      <AppText variant="caption" style={styles.note}>
        Your password is never stored. You can change this any time in Settings.
      </AppText>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.mutedForeground, lineHeight: 22 },
  note: { color: colors.softMuted, marginTop: spacing.md, lineHeight: 16 },
});
