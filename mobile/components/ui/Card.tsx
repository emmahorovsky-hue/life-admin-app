import { StyleSheet, View, ViewProps } from 'react-native';
import { radius, spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
  padding?: CardPadding;
}

export function Card({ padding = 'lg', style, ...props }: CardProps) {
  return <View style={[styles.card, paddings[padding], style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
  },
});

const paddings: Record<CardPadding, { padding: number }> = {
  none: { padding: 0 },
  sm: { padding: spacing.sm },
  md: { padding: spacing.md },
  lg: { padding: spacing.lg },
};
