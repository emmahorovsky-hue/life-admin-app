import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { colors, textStyles } from '../lib/theme';
import { SCREEN_PAD } from '../lib/quiet';
import { wordmarkMetrics } from './Wordmark';

const WORDMARK_SIZE = 60;

// The native splash draws `assets/splash-icon.png` at this width (imageWidth in
// app.config.ts). We render the *same asset at the same width* here, so the
// wordmark is pixel-identical across the handover — no font to mismatch, because
// there is no live font (LIF-221 follow-up). The square is deliberately absent
// from the PNG; it is stamped in below.
const IMAGE_W = 293;

// splash-icon.png is a 1024² canvas. These are the measured ink bounds of the
// "Paypr" glyphs inside it, converted to display points at IMAGE_W. Re-derive
// them (decode the PNG, threshold the dark pixels) if the asset is ever
// regenerated — the stamp is placed off these, not off RN text metrics, because
// the live text under-measures its own width with negative letterSpacing and
// clipped the trailing "r" (the bug this replaces).
const PX = IMAGE_W / 1024; // 0.286 pt per source pixel
const GLYPH_RIGHT = 771 * PX; // 220.6 — right ink edge of the "r"
const GLYPH_TOP = 321 * PX; //  91.8 — cap top
const GLYPH_BASELINE = 465 * PX; // 133.1 — "P" baseline
const GLYPH_DESCENT = 506 * PX; // 144.8 — bottom of the y/p descenders

// Show only the wordmark band, not the full 293×293 square: the PNG's opaque
// Snow fill matches colors.background exactly (both #FBFBF9), so within the band
// it composites seamlessly, but the full image would otherwise paint its Snow
// over the rule and tagline below. A little air above the cap and below the
// descenders, sized to land close to the old 60/1.033 line box so the rule sits
// where it did before.
const BAND_TOP = GLYPH_TOP - 8;
const BAND_BOTTOM = GLYPH_DESCENT + 4;
const BAND_HEIGHT = BAND_BOTTOM - BAND_TOP;

/**
 * The logged-in splash (LIF-218). Sits over the app while auth + fonts resolve;
 * the parent unmounts it once `onDone` has fired AND loading is finished, so
 * the brand moment is never cut mid-animation.
 *
 * The wordmark is the native splash's own image, clipped to its band and drawn
 * in the same place at the same size — so this component picks up from the
 * static native frame invisibly rather than swapping a raster for live type
 * (which read as a weight change at the handover). The one thing that animates
 * is the orange square: it is not in the PNG, so it can arrive rather than blink.
 *
 * Nothing starts until `start`. This mounts behind the native splash, so an
 * animation on mount would play — and often finish — while the user is still
 * looking at the static frame. The parent flips `start` in the same frame it
 * calls `SplashScreen.hideAsync()`.
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

  const square = wordmarkMetrics(WORDMARK_SIZE).square;

  return (
    <View style={styles.screen}>
      {/* Fixed to the image footprint and centred as a whole, exactly like the
          native frame centres its canvas — so the glyphs land where the static
          frame left them. `overflow: hidden` crops the 293-tall image to the
          wordmark band. */}
      <View style={styles.lockup}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.wordmark}
          resizeMode="contain"
          fadeDuration={0}
        />
        {/* The stamped square. Placed off the measured ink bounds: just past the
            "r", its bottom a hair below the baseline — where the live lockup's
            flex-end + marginBottom put it. */}
        <Animated.View
          style={[
            styles.stamp,
            {
              width: square.width,
              height: square.height,
              backgroundColor: square.backgroundColor,
              left: GLYPH_RIGHT + square.marginLeft,
              top: GLYPH_BASELINE - BAND_TOP + 4 - square.height,
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
  lockup: {
    width: IMAGE_W,
    height: BAND_HEIGHT,
    overflow: 'hidden',
  },
  // The full 293×293 image, pulled up so the wordmark band aligns to the top of
  // the clipped lockup. Snow above/below the band is cropped away.
  wordmark: {
    position: 'absolute',
    left: 0,
    top: -BAND_TOP,
    width: IMAGE_W,
    height: IMAGE_W,
  },
  stamp: { position: 'absolute' },
  rule: { width: 104, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 28 },
  // `monoLabel` is exactly this — 11/1.4 tracked uppercase mono — so take the
  // role rather than restating it (LIF-210). `lineHeight` is pinned because the
  // centred column's height sets how far above centre the wordmark sits, and
  // that offset has to match the static frame's: leaving it to the platform
  // default would move the handover by a few points per OS version.
  // `paddingHorizontal` is the fix for the clipped trailing "D": iOS omits the
  // last glyph's trailing letterSpacing advance from the Text's measured width,
  // so it paints past the view bounds and is cut. Padding both sides keeps it
  // centred while giving that last glyph room.
  tagline: {
    ...textStyles.monoLabel, lineHeight: 14, color: colors.softMuted, marginTop: 24,
    paddingHorizontal: 4, textAlign: 'center',
  },
});
