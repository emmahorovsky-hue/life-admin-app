import { useEffect, useState } from 'react';
import { Image, StyleSheet, StyleProp, View, ImageStyle, ViewStyle } from 'react-native';
import { logoInset } from '@life-admin/shared';
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
    // subtle border so colored/dark logos stay readable. The inset gives every
    // brand the same margin inside the chip (logo.dev's own padding varies);
    // it lives on a wrapping View because Image ignores padding.
    return (
      <View style={[box, styles.logo, { padding: logoInset(size) }, style]}>
        <Image
          source={{ uri: url }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          style={styles.logoImage}
        />
      </View>
    );
  }

  // categoryIconFor returns a stable, module-level component — resolve it to a
  // capitalised local so JSX treats it as a component, not an element name.
  const CategoryIcon = categoryIconFor(category);

  return (
    <View style={[box, styles.fallback, style]}>
      <CategoryIcon size={Math.round(size * 0.55)} color={colors.mutedForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
