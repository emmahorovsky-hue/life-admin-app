import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { spacing } from '@life-admin/shared';
import { colors } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';

/**
 * Top-left close on the auth screens — the way back to the onboarding carousel
 * (LIF-221). Login and register are presented as modals over the carousel, so
 * this dismisses them downward. A returning user can land straight on login with
 * no carousel beneath (nothing to dismiss); there we navigate to it instead.
 * Absolutely positioned so it overlays the vertically-centred form without
 * shifting it, and it sits below the top safe-area inset the root `SafeAreaView`
 * already applies.
 */
export function AuthClose() {
  const router = useRouter();
  const close = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/(auth)/onboarding');
  };
  return (
    <Pressable
      onPress={close}
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
