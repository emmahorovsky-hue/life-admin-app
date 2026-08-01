import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { spacing } from '@life-admin/shared';
import { colors } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';

/**
 * Top-left close on the auth modal — the way back to the onboarding carousel
 * (LIF-221). Login is presented as a modal over the carousel, so this dismisses
 * it downward.
 *
 * A returning user is sent straight to login as the stack root, with no carousel
 * beneath: there is nothing to go back *to*, so the button doesn't render rather
 * than inventing a destination — an X that opens a first-run carousel the user
 * already dismissed is worse than no X.
 *
 * Absolutely positioned so it overlays the vertically-centred form without
 * shifting it, and it sits below the top safe-area inset the root `SafeAreaView`
 * already applies.
 */
export function AuthClose() {
  const router = useRouter();
  // Stack depth beneath a given modal doesn't change while it's up, so reading
  // this at render (rather than on press) is stable for this screen's lifetime.
  if (!router.canDismiss()) return null;
  return (
    <Pressable
      onPress={() => router.dismissAll()}
      accessibilityRole="button"
      accessibilityLabel="Back to intro"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="close" size={24} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: spacing.sm,
    // A 40pt centred tap target, nudged left so the glyph — not the box edge —
    // lines up with the screen padding the form content uses.
    left: SCREEN_PAD - 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pressed: { opacity: 0.6 },
});
