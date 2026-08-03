import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../lib/theme';

// Archivo ExtraBold's own metrics (unitsPerEm 1000): advance("Paypr") = 2.928em,
// ink spans 0.075em … 2.921em. `letterSpacing` (-0.033em) lands on all five
// glyphs, so RN measures the string at 2.928 - 5(0.033) = 2.763em while the "r"
// still inks out to 2.921 - 4(0.033) = 2.789em.
//
// We reserve that box ourselves rather than letting the Text measure itself,
// because the measurement is only right if Archivo has already registered. It
// has not during the launch window — `PrivacyCover` mounts while iOS still
// reports `inactive` and `useFonts` is unresolved — so the view was sized to
// system-font metrics, never re-measured when the real font arrived, and iOS
// clipped the trailing "r" at the stale bound. The square is laid out straight
// after the Text, so it landed on top of the glyph that had been cut.
//
// The overhang is paint room past the reserved width (RN is border-box, so the
// width *is* the clip bound); `marginRight` cancels it so the square still sits
// at 2.763em + its own marginLeft, exactly where it has always been.
const TEXT_ADVANCE = 2.763;
const INK_OVERHANG = 0.06;

/**
 * The Paypr lockup — "Paypr" in Archivo ExtraBold + the brand-orange square
 * (LIF-218). Drawn as type rather than shipped as an image on purpose: the
 * splash renders it at 60 and the onboarding header at 16, and an image asset
 * at two sizes is two things that can drift from each other and from
 * `assets/splash-icon.png`, which is the same lockup rasterised.
 *
 * The wordmark is a brand size, deliberately off the LIF-210 ladder — the same
 * licence the Dashboard's 54px hero takes. Everything scales off `size`, so the
 * proportions below are the single definition of the lockup.
 */
export function wordmarkMetrics(size: number) {
  return {
    text: {
      fontFamily: fonts.sans.extrabold,
      fontSize: size,
      lineHeight: size * 1.033,
      letterSpacing: size * -0.033,
      color: colors.foreground,
      width: size * (TEXT_ADVANCE + INK_OVERHANG),
      marginRight: size * -INK_OVERHANG,
    },
    square: {
      width: size * 0.233,
      height: size * 0.233,
      borderRadius: 0,
      backgroundColor: colors.brandOrange,
      marginLeft: size * 0.083,
      marginBottom: size * 0.133,
    },
  };
}

export function Wordmark({ size = 60, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const metrics = wordmarkMetrics(size);
  return (
    <View style={[styles.row, style]} accessibilityRole="image" accessibilityLabel="Paypr">
      {/* The box is fixed, so the type must not reflow inside it: a fallback
          font wider than Archivo would otherwise wrap to a second line for the
          frames before Archivo registers. `clip` because an ellipsis in a brand
          mark is worse than a hair off the "r". Font scaling is off because the
          square is a plain View that Dynamic Type never touches — scaling only
          the type would pull the lockup apart. */}
      <Text
        style={metrics.text}
        numberOfLines={1}
        ellipsizeMode="clip"
        allowFontScaling={false}
      >
        Paypr
      </Text>
      <View style={metrics.square} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
