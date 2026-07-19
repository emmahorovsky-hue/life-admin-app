import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currencies, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui';
import { updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors, fontMono, fonts } from '../../lib/theme';

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
          <Text style={styles.title}>Default currency</Text>
          <Text style={styles.fieldLabel}>CURRENCY</Text>
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
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>Dashboard totals are shown in this currency.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  content: { padding: 22 },
  title: { fontFamily: fonts.sans.extrabold, fontSize: 22, color: colors.foreground },

  fieldLabel: {
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 1.4,
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
  segmentText: { fontFamily: fonts.sans.medium, fontSize: 13, color: colors.foreground },
  segmentTextActive: { fontFamily: fonts.sans.semibold, color: colors.background },

  hint: { marginTop: spacing.md, fontSize: 12, color: colors.mutedForeground },
  error: { marginTop: spacing.md, fontSize: 13, color: colors.destructive },
});
