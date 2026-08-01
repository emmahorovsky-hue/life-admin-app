import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, textStyles } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';
import { wordmarkMetrics } from './Wordmark';

const WORDMARK_SIZE = 60;

/**
 * The logged-in splash (LIF-218). Sits over the app while auth + fonts resolve;
 * the parent unmounts it once `onDone` has fired AND loading is finished, so
 * the brand moment is never cut mid-animation.
 *
 * Two things differ from the 1a prototype, both forced by the native splash
 * sitting in front of this one:
 *
 * - **The wordmark does not animate in.** `assets/splash-icon.png` is the same
 *   wordmark at the same size and position, so it is already on screen when
 *   this mounts. Fading it in from 0 would read as the logo blinking out and
 *   back. The stamp is the moment; the wordmark is the thing it lands on —
 *   which is why the static frame carries no square: it is the one part of the
 *   lockup that arrives, and drawing it there too would blink it out for the
 *   160ms hold below and then pop it back.
 * - **Nothing starts until `start`.** This component mounts behind the native
 *   splash, so an animation on mount would play — and often finish — while the
 *   user is still looking at the static frame. The parent flips `start` in the
 *   same frame it calls `SplashScreen.hideAsync()`.
 */
export function BrandSplash({ start, onDone }: { start: boolean; onDone?: () => void }) {
  const stamp = useRef(new Animated.Value(0)).current; // 0 → 1: scale down onto the baseline
  const rule = useRef(new Animated.Value(0)).current; // 0 → 1: scaleX
  const tag = useRef(new Animated.Value(0)).current; // 0 → 1: fade

  // Held in a ref so a parent that passes an inline callback can't restart the
  // sequence on re-render.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!start) return;

    const sequence = Animated.sequence([
      // A beat on the static frame before the square lands — without it the
      // stamp fires on the same frame the native splash disappears.
      Animated.delay(160),
      Animated.spring(stamp, {
        toValue: 1, stiffness: 260, damping: 18, mass: 0.7, useNativeDriver: true,
      }),
      Animated.timing(rule, {
        toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(tag, {
        toValue: 1, duration: 260, useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => finished && done.current?.());
    return () => sequence.stop();
  }, [start, stamp, rule, tag]);

  const metrics = wordmarkMetrics(WORDMARK_SIZE);
  // The square is floated out of layout flow rather than sitting in a row with
  // the wordmark (LIF-221). In a row it keeps its width even at opacity 0, so
  // the centred lockup pushes "Paypr" ~9pt left of centre — but the static
  // native frame draws the wordmark *alone*, dead-centre. That mismatch showed
  // as the wordmark jumping sideways on the handover. Text-only box → the
  // wordmark centres exactly where the static frame left it; the square lands on
  // its trailing edge without shifting it. `marginBottom`/`marginLeft` become
  // the absolute insets so the gap and baseline are unchanged from the lockup.
  const { marginBottom, marginLeft, ...squareBox } = metrics.square;

  return (
    <View style={styles.screen}>
      <View style={styles.lockup}>
        <Animated.Text style={metrics.text}>Paypr</Animated.Text>
        <Animated.View
          style={[
            squareBox,
            {
              position: 'absolute',
              left: '100%',
              marginLeft,
              bottom: marginBottom,
              opacity: stamp,
              transform: [
                { scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) },
                { translateY: stamp.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
              ],
            },
          ]}
        />
      </View>

      <Animated.View style={[styles.rule, { transform: [{ scaleX: rule }] }]} />
      <Animated.Text style={[styles.tagline, { opacity: tag }]}>
        Your paper trail, handled
      </Animated.Text>
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
    zIndex: 100,
  },
  // Text-only box (the square is absolute) so its width is the wordmark's and
  // the parent's `alignItems: center` lands it exactly where the static native
  // splash frame drew it — see the float note above (LIF-221).
  lockup: {},
  rule: { width: 104, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 28 },
  // `monoLabel` is exactly this — 11/1.4 tracked uppercase mono — so take the
  // role rather than restating it (LIF-210). `lineHeight` is pinned because the
  // centred column's height sets how far above centre the wordmark sits, and
  // that offset has to match the static frame's: leaving it to the platform
  // default would move the handover by a few points per OS version.
  tagline: {
    ...textStyles.monoLabel, lineHeight: 14, color: colors.softMuted, marginTop: 24,
  },
});
