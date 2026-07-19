import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@life-admin/shared';
import { colors, fonts } from '../lib/theme';
import { Card } from './ui';

type EmptyStateTone = 'sheet' | 'inline';
type IconVariant = 'brand' | 'muted';

export interface EmptyStateProps {
  /**
   * `sheet` (default) floats a receipt-style card — use where the empty state
   * owns a list/screen (Subscriptions, Timeline). `inline` is a compact,
   * surface-less block for dropping inside an existing card (Dashboard tiles).
   */
  tone?: EmptyStateTone;
  /**
   * Ionicon for the leading disc. Defaults to a receipt glyph; pass a different
   * name (e.g. `search-outline` for a filtered state) or `null` to omit it.
   */
  iconName?: keyof typeof Ionicons.glyphMap | null;
  iconVariant?: IconVariant;
  /** Space Mono uppercase eyebrow. */
  kicker?: string;
  title: string;
  description?: string;
  /** Primary action, typically a `<Button />`. */
  action?: ReactNode;
}

// 10% brand-orange tint for the leading disc (RN accepts 8-digit #RRGGBBAA).
const BRAND_DISC = `${colors.brandOrange}1A`;

/**
 * The one on-brand empty state for the app (mobile). Mirrors the web
 * `EmptyState` so first-run, no-results and "all caught up" moments read the
 * same across platforms; no screen hand-rolls its own "nothing here yet".
 */
export function EmptyState({
  tone = 'sheet',
  iconName = 'receipt-outline',
  iconVariant = 'brand',
  kicker,
  title,
  description,
  action,
}: EmptyStateProps) {
  const body = (
    <View style={styles.body}>
      {iconName ? (
        <View style={[styles.disc, iconVariant === 'brand' ? styles.discBrand : styles.discMuted]}>
          <Ionicons
            name={iconName}
            size={24}
            color={iconVariant === 'brand' ? colors.brandOrange : colors.mutedForeground}
          />
        </View>
      ) : null}
      <View style={styles.textGroup}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={[styles.title, tone === 'inline' && styles.titleInline]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );

  return tone === 'inline' ? (
    <View style={styles.inline}>{body}</View>
  ) : (
    <Card style={styles.sheet}>{body}</Card>
  );
}

const styles = StyleSheet.create({
  sheet: { alignItems: 'center', paddingVertical: spacing.xl, marginTop: spacing.sm },
  inline: { alignItems: 'center', paddingVertical: spacing.lg },
  body: { alignItems: 'center', gap: spacing.md },
  textGroup: { alignItems: 'center', gap: spacing.xs + 2 },
  disc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discBrand: { backgroundColor: BRAND_DISC },
  discMuted: { backgroundColor: colors.secondary },
  kicker: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  title: {
    fontFamily: fonts.sans.bold,
    fontSize: 18,
    color: colors.foreground,
    textAlign: 'center',
  },
  titleInline: { fontSize: 16 },
  description: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 260,
  },
});
