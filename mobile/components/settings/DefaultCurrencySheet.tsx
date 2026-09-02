import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { currencies, currencyName, currencySymbol, DEFAULT_CURRENCY, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AppText, FormSheet, useToast, type FormSheetHandle, type OpenableSheetHandle } from '../ui';
import { IconCheck } from '../icons';
import { updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors } from '../../lib/theme';

export type DefaultCurrencySheetHandle = OpenableSheetHandle;

/**
 * Bottom-sheet default-currency picker — the mobile stand-in for web
 * AppearancePanel's currency select (folded into Account until mobile gets an
 * Appearance screen with dark mode). Tapping a row persists it via
 * PATCH /auth/profile.
 *
 * A scrolling list rather than the segmented row this used to share with
 * SubscriptionFormSheet: that control divided the sheet's width evenly between
 * the options, which was legible at four currencies and unreadable at twenty.
 * Rows carry the full name too — "SEK" and "NOK" and "DKK" are not a choice
 * anyone can make from three letters and a shared "kr".
 */
export const DefaultCurrencySheet = forwardRef<DefaultCurrencySheetHandle>(
  function DefaultCurrencySheet(_props, ref) {
    const sheetRef = useRef<FormSheetHandle>(null);
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useImperativeHandle(ref, () => ({
      open: () => {
        setError('');
        sheetRef.current?.open();
      },
    }));

    const handleSelect = async (defaultCurrency: string) => {
      if (defaultCurrency === user?.defaultCurrency) {
        sheetRef.current?.close();
        return;
      }
      setError('');
      setLoading(true);
      try {
        const res = await updateProfile({ defaultCurrency });
        updateUser(res.data.user);
        // Dismiss before the toast: ToastProvider renders inside the sheet
        // portal's children, so a toast raised while the sheet is still up
        // spends its first moments behind it.
        sheetRef.current?.close();
        toast.success('Default currency updated.');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to update currency. Please try again.'));
      } finally {
        setLoading(false);
      }
    };

    return (
      <FormSheet ref={sheetRef} title="Default currency">
        <AppText variant="monoLabel" style={styles.fieldLabel}>CURRENCY</AppText>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          bounces={false}
        >
          {currencies.map((code) => {
            const active = (user?.defaultCurrency ?? DEFAULT_CURRENCY) === code;
            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: loading }}
                disabled={loading}
                onPress={() => handleSelect(code)}
                style={[styles.row, active && styles.rowActive]}
              >
                <AppText variant="monoData" style={styles.rowCode}>{code}</AppText>
                <AppText variant="footnote" style={styles.rowName} numberOfLines={1}>
                  {currencyName(code)}
                </AppText>
                <AppText variant="monoMeta" muted style={styles.rowSymbol}>
                  {currencySymbol(code)}
                </AppText>
                {active ? <IconCheck size={16} color={colors.brandOrange} ink="inherit" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <AppText variant="caption" style={styles.hint}>Home totals are shown in this currency.</AppText>
        {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
      </FormSheet>
    );
  },
);

const styles = StyleSheet.create({
  // No marginTop: FormSheet's title already carries the gap below it.
  fieldLabel: {
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  // Capped so the sheet keeps its shape: tall enough to make it obvious the
  // list scrolls, short enough to leave the hint and any error on screen.
  //
  // A plain ScrollView, deliberately — unlike Dropdown's menu, which had to
  // switch to @gorhom's BottomSheetScrollView to get the pan at all. This list
  // is in normal flow rather than an absolutely-positioned popover, so it wins
  // the gesture on its own, and FormSheet's dynamic sizing measures it
  // correctly. Swapping it for BottomSheetScrollView nests two sheet
  // scrollables, and the outer one then reports all twenty rows and snaps the
  // sheet to nearly full screen.
  list: {
    maxHeight: 264,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.card,
  },
  listContent: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  rowActive: { backgroundColor: 'rgba(229,61,0,0.08)' },
  rowCode: { color: colors.foreground, width: 44 },
  rowName: { flex: 1, color: colors.mutedForeground },
  rowSymbol: { color: colors.mutedForeground, minWidth: 28, textAlign: 'right' },

  hint: { marginTop: spacing.md, color: colors.mutedForeground },
  error: { marginTop: spacing.md, color: colors.destructive },
});
