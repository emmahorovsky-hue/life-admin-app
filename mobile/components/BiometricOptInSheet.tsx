import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { SCREEN_PAD, SHEET_BACKDROP_OPACITY, SHEET_BACKGROUND, SHEET_HANDLE } from '../lib/quiet';
import { AppText, Button, ScreenTitle, useToast } from './ui';

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
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
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
      // Mark it seen on *presentation*, not on the answer. Declining and killing
      // the app mid-prompt are the same intent as far as the next launch is
      // concerned: do not ask again.
      await biometricOffer.markSeen(userId);
      if (!isMounted) return;
      offered.current = true;
      setLabel(name);
      sheetRef.current?.present();
    })();
    return () => { isMounted = false; };
  }, [userId, canOffer]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={SHEET_BACKDROP_OPACITY}
      />
    ),
    [],
  );

  const enable = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const result = await setQuickUnlock(userId, true, label);
      if (result === 'cancelled') return; // stay open; they may want to retry
      sheetRef.current?.dismiss();
      if (result === 'ok') toast.success(`${label} unlock is on.`);
      else if (result === 'no-session') toast.error('Please sign in again to turn this on.');
      else toast.error('Could not turn that on. You can try again in Settings.');
    } finally {
      setSaving(false);
    }
  }, [userId, label, toast]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={SHEET_BACKGROUND}
      handleIndicatorStyle={SHEET_HANDLE}
    >
      <BottomSheetView
        accessibilityLabel={`Unlock with ${label}`}
        style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        <ScreenTitle style={styles.title}>Unlock with {label}?</ScreenTitle>

        <AppText variant="body" style={styles.body}>
          Skip typing your password when you come back. Paypr stays locked until
          it recognises you, so an unlocked phone is not an open file.
        </AppText>
        <AppText variant="caption" style={styles.note}>
          Your password is never stored. You can change this any time in Settings.
        </AppText>

        <Button
          title={`Use ${label}`}
          onPress={enable}
          loading={saving}
          style={styles.action}
        />
        <Button
          title="Not now"
          variant="outline"
          onPress={() => sheetRef.current?.dismiss()}
          disabled={saving}
          style={styles.action}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PAD, paddingTop: spacing.sm },
  title: { marginBottom: spacing.md },
  body: { color: colors.mutedForeground, lineHeight: 22 },
  note: { color: colors.softMuted, marginTop: spacing.md, lineHeight: 16 },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
});
