import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { spacing } from '@life-admin/shared';
import { colors } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';

/**
 * Top-left close on the auth modal — the way back to the carousel (LIF-221).
 * Login is presented as a modal over it, so this dismisses downward.
 *
 * The carousel is the logged-out home on every launch, so there is always
 * something to go back to and this button always renders. The one path that
 * arrives without a carousel beneath is a cold-start deep link straight to
 * login (an email verification link) — there we navigate to the carousel rather
 * than dismiss, which lands the user in the same place either way.
 *
 * Absolutely positioned so it overlays the vertically-centred form without
 * shifting it, and it sits below the top safe-area inset the root `SafeAreaView`
 * already applies.
 */
export function AuthClose() {
  const router = useRouter();
  // `canGoBack`/`back` rather than `canDismiss`/`dismissAll`: they are a matched
  // pair, both resolving against the focused navigator. The dismiss pair is not
  // — `canDismiss` walks *down* the state tree and reports true if any stack has
  // depth, while `dismissAll` queues a POP_TO_TOP that the root Stack (a single
  // route, `(auth)`) can absorb. Popping one modal is what we mean anyway.
  const close = () => {
    if (router.canGoBack()) router.back();
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
    // A 44pt centred tap target — the iOS minimum — nudged left so the glyph,
    // not the box edge, lines up with the screen padding the form content uses.
    left: SCREEN_PAD - 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pressed: { opacity: 0.6 },
});
