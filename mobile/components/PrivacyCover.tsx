import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';
import { Wordmark } from './Wordmark';

/**
 * Hides the app's contents from the iOS app switcher.
 *
 * When an app resigns active, iOS photographs it and writes that image to disk
 * for the switcher. Without a cover, that photograph is the dashboard — every
 * subscription and the monthly total — visible to anyone who double-taps the
 * home bar, and sitting in the filesystem afterwards. It applies to *every*
 * user, whether or not biometric quick-unlock is enabled, so it is not part of
 * the lock feature (OWASP MASTG-TEST-0059 / MASWE-0055).
 *
 * Deliberately not `BrandSplash`: that one animates its stamp on mount, which
 * would replay every time the user flicks to another app. This is the same
 * lockup held still.
 *
 * Purely cosmetic — it hides pixels, it does not gate anything. The lock screen
 * is the security control; this is the curtain.
 */
export function PrivacyCover() {
  return (
    <View style={styles.screen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Wordmark size={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PAD,
    // Above the lock screen (200) and the splash (100): this is the last thing
    // drawn before the OS takes its photograph.
    zIndex: 300,
  },
});
