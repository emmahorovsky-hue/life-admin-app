import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currencies, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AppText, useToast } from '../ui';
import { updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors, fonts } from '../../lib/theme';

export interface DefaultCurrencySheetHandle {
  open: () => void;
}

/**
 * Bottom-sheet default-currency picker — the mobile stand-in for web
 * AppearancePanel's currency select (folded into Account until mobile gets an
 * Appearance screen with dark mode). Reuses SubscriptionFormSheet's segmented
 * currency row; tapping a code persists it via PATCH /auth/profile.
 */
export const DefaultCurrencySheet = forwardRef<DefaultCurrencySheetHandle>(
  function DefaultCurrencySheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useImperativeHandle(ref, () => ({
      open: () => {
        setError('');
        sheetRef.current?.present();
      },
    }));

    const handleSelect = async (defaultCurrency: string) => {
      if (defaultCurrency === user?.defaultCurrency) {
        sheetRef.current?.dismiss();
        return;
      }
      setError('');
      setLoading(true);
      try {
        const res = await updateProfile({ defaultCurrency });
        updateUser(res.data.user);
        toast.success('Default currency updated.');
        sheetRef.current?.dismiss();
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to update currency. Please try again.'));
      } finally {
        setLoading(false);
      }
    };

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          <AppText variant="title" style={styles.title}>Default currency</AppText>
          <AppText variant="monoLabel" style={styles.fieldLabel}>CURRENCY</AppText>
          <View style={styles.segmentRow}>
            {currencies.map((code) => {
              const active = (user?.defaultCurrency ?? 'SGD') === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: loading }}
                  disabled={loading}
                  onPress={() => handleSelect(code)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <AppText variant="footnote" weight={500} style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {code}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText variant="caption" style={styles.hint}>Dashboard totals are shown in this currency.</AppText>
          {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  content: { padding: 22 },
  title: { color: colors.foreground },

  fieldLabel: {
    color: colors.mutedForeground,
    marginBottom: 6,
    marginTop: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  segment: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.foreground },
  segmentText: { color: colors.foreground },
  segmentTextActive: { fontFamily: fonts.sans.semibold, color: colors.background },

  hint: { marginTop: spacing.md, color: colors.mutedForeground },
  error: { marginTop: spacing.md, color: colors.destructive },
});
