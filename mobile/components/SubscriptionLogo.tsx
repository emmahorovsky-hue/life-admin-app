import { useEffect, useState } from 'react';
import { Image, StyleSheet, StyleProp, View, ImageStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryIconFor, logoUrlForName } from '../lib/subscriptionLogo';
import { colors } from '../lib/theme';

interface SubscriptionLogoProps {
  name: string;
  category: string;
  /** Rendered width/height in px. */
  size?: number;
  // ImageStyle & ViewStyle so the same style prop works for both render paths.
  style?: StyleProp<ImageStyle & ViewStyle>;
}

/**
 * Rounded brand-logo tile for a subscription: brand logo from logo.dev
 * (derived from the name) when available, category icon otherwise.
 * Mirrors client/src/components/SubscriptionLogo.tsx.
 */
export function SubscriptionLogo({ name, category, size = 36, style }: SubscriptionLogoProps) {
  const url = logoUrlForName(name);
  const [failed, setFailed] = useState(false);

  // Reset the error state when the name changes so a row reused for a
  // different subscription re-attempts its own logo.
  useEffect(() => setFailed(false), [name]);

  const box = { width: size, height: size, borderRadius: 6 };

  if (url && !failed) {
    // Brand logos are transparent PNGs — sit them on a white chip with a
    // subtle border so colored/dark logos stay readable.
    return (
      <Image
        source={{ uri: url }}
        onError={() => setFailed(true)}
        resizeMode="contain"
        style={[box, styles.logo, style]}
      />
    );
  }

  return (
    <View style={[box, styles.fallback, style]}>
      <Ionicons
        name={categoryIconFor(category)}
        size={Math.round(size * 0.55)}
        color={colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  fallback: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
