import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../lib/theme';

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
      <Text style={metrics.text}>Paypr</Text>
      <View style={metrics.square} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
