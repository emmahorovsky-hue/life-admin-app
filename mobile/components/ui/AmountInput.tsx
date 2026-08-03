import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { currencySymbol, radius } from '@life-admin/shared';
import { colors, textStyles } from '../../lib/theme';
import { AppText } from './AppText';

export interface AmountInputProps extends Omit<TextInputProps, 'style'> {
  /** Drives the symbol in front of the field. Never editable from in here — the
   *  currency is chosen elsewhere (a Dropdown, or the step's own control). */
  currency: string;
  /**
   * `md` — the headline field of a form, where the amount is what the surface
   * is asking for (add/edit).
   * `sm` — one amount among several in a list of rows, at the type scale's own
   * "amounts in receipt rows" role. At `md` a column of these reads as several
   * headlines stacked, which is a screen with no hierarchy at all.
   */
  size?: 'md' | 'sm';
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The money field: a currency symbol, then the amount, in one bordered box.
 *
 * The symbol sits outside the input on purpose. It has to be visible while
 * typing — an amount with no currency in front of it is the kind of ambiguity
 * that ends in a subscription filed in the wrong one — but it must not be
 * editable, and putting it *in* the value would mean parsing it back out of
 * every keystroke.
 *
 * Two sizes, one component, so the two surfaces that ask for an amount cannot
 * drift apart in border, height rhythm, symbol treatment or keyboard. See
 * `size` for which goes where.
 */
function AmountField({
  currency,
  size = 'md',
  containerStyle,
  Field,
  ...props
}: AmountInputProps & { Field: typeof TextInput | typeof BottomSheetTextInput }) {
  const small = size === 'sm';
  return (
    <View style={[styles.box, small && styles.boxSm, containerStyle]}>
      <AppText variant={small ? 'monoMeta' : 'monoStatSm'} style={styles.symbol}>
        {currencySymbol(currency)}
      </AppText>
      <Field
        style={[small ? textStyles.monoData : textStyles.monoStatSm, styles.input]}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.faint}
        {...props}
      />
    </View>
  );
}

/** For a plain screen. */
export function AmountInput(props: AmountInputProps) {
  return <AmountField {...props} Field={TextInput} />;
}

/**
 * For inside a FormSheet or any other BottomSheetModal — same split, and the
 * same reason, as `Input` / `SheetInput`: `BottomSheetTextInput` throws outside
 * a sheet, and a plain `TextInput` inside one never tells gorhom which field has
 * focus, so `keyboardBehavior` has nothing to lift the sheet to.
 */
export function SheetAmountInput(props: AmountInputProps) {
  return <AmountField {...props} Field={BottomSheetTextInput} />;
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  boxSm: { height: 44, paddingHorizontal: 10 },
  symbol: { color: colors.mutedForeground, marginRight: 4 },
  input: { flex: 1, color: colors.foreground },
});
