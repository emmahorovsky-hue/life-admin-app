import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { AppText } from './AppText';

export interface DropdownOption {
  value: string;
  /** Defaults to `value` — the currency codes and cycle ids read fine as-is. */
  label?: string;
  /** Secondary text at the end of the row, e.g. a currency symbol. */
  meta?: string;
}

export interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  /**
   * Open state is the caller's, not this component's: a screen with more than
   * one popover has to be able to close the others as it opens this one, and
   * the sheets here reset every popover when they re-present.
   */
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /**
   * `field` — a 52pt form control, the shape used inside SubscriptionFormSheet.
   * `inline` — a chip sized to sit in running text, for a choice that belongs in
   * a sentence rather than in a labelled field.
   */
  size?: 'field' | 'inline';
  /** Which edge of the trigger the menu hangs from. Defaults to the size's own. */
  align?: 'left' | 'right';
  menuWidth?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's dropdown: a trigger that opens a menu floating over whatever is
 * below it.
 *
 * Absolutely positioned rather than pushing the layout down — a menu that
 * reflows the form moves the very control the user is aiming at — and *not* a
 * bottom sheet, which is what @gorhom would fight over: every screen that needs
 * one of these is already inside a sheet, and a second modal presented from
 * within the first is the arrangement to avoid (LIF-239 settled the rule that
 * overlays are sheets; this is a popover inside one, not a competing overlay).
 *
 * Haptics stay with the caller, like every other control in `ui/` — the sheets
 * own a `selectHaptic` and fire it alongside their own state changes.
 */
export function Dropdown({
  value,
  options,
  onSelect,
  open,
  onToggle,
  disabled = false,
  size = 'field',
  align,
  menuWidth,
  accessibilityLabel,
  style,
}: DropdownProps) {
  const inline = size === 'inline';
  const edge = align ?? (inline ? 'left' : 'right');
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.anchor, style]}>
      <Pressable
        disabled={disabled}
        onPress={onToggle}
        style={inline ? styles.inlineTrigger : styles.fieldTrigger}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open, disabled }}
        hitSlop={inline ? 6 : undefined}
      >
        <AppText
          variant={inline ? 'monoMeta' : 'monoData'}
          style={inline ? styles.inlineTriggerText : styles.fieldTriggerText}
        >
          {selected?.label ?? value}
        </AppText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={inline ? 12 : 14}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open && (
        <View
          style={[
            styles.menu,
            inline ? styles.menuInline : styles.menuField,
            edge === 'left' ? styles.menuLeft : styles.menuRight,
            menuWidth ? { width: menuWidth } : null,
          ]}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                disabled={disabled}
                onPress={() => onSelect(option.value)}
                style={[styles.option, active && styles.optionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText variant="monoData" style={styles.optionLabel}>
                  {option.label ?? option.value}
                </AppText>
                {option.meta ? (
                  <AppText variant="monoMeta" muted style={styles.optionMeta}>
                    {option.meta}
                  </AppText>
                ) : null}
                {active && <Ionicons name="checkmark" size={16} color={colors.brandOrange} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative', zIndex: 20 },

  fieldTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  fieldTriggerText: { color: colors.foreground },

  // Sized to the type it sits in, not to a form field — it is a word in a
  // sentence that happens to be tappable.
  inlineTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
  },
  inlineTriggerText: { color: colors.foreground },

  menu: {
    position: 'absolute',
    width: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    overflow: 'hidden',
    zIndex: 30,
    // Float above the content: shadow (iOS) + elevation (Android).
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuField: { top: 56 }, // trigger height (52) + 4 gap
  menuInline: { top: 30 },
  menuLeft: { left: 0 },
  menuRight: { right: 0 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  optionActive: { backgroundColor: 'rgba(229,61,0,0.08)' },
  optionLabel: { flex: 1, color: colors.foreground },
  optionMeta: { color: colors.mutedForeground },
});
