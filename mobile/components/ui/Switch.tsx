import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { hairline, radius } from '@life-admin/shared';
import { colors } from '../../lib/theme';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Receipt-style toggle matching web's design-1D switch exactly
// (client/src/components/ui/switch.tsx): 44×24 track, 1.5px border, sharp
// corners — on = orange track/snow knob, off = sand track/ink knob. Not RN's
// built-in Switch, which can only draw the round pill look.
export function Switch({ checked, onCheckedChange, disabled, style }: SwitchProps) {
  const knobPosition = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(checked ? 23 : 2, { duration: 150 }) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      // aria-checked is RN's alias for accessibilityState.checked and the only
      // spelling react-native-web forwards to the DOM.
      aria-checked={checked}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      style={[
        styles.track,
        checked ? styles.trackOn : styles.trackOff,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        style={[styles.knob, checked ? styles.knobOn : styles.knobOff, knobPosition]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderWidth: hairline,
    borderRadius: radius.base,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  trackOff: { backgroundColor: colors.secondary, borderColor: colors.border },
  knob: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
  },
  // Web's knob literal #FAFAF8 is design Snow; colors.background is the same
  // token as actually rendered (see packages/shared/src/tokens/colors.ts).
  knobOn: { backgroundColor: colors.background },
  knobOff: { backgroundColor: colors.foreground },
  disabled: { opacity: 0.5 },
});
