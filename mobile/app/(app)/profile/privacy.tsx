import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { hairline, spacing } from '@life-admin/shared';
import { DeleteAccountSheet } from '../../../components/settings/DeleteAccountSheet';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { AppText, Button, Card, type OpenableSheetHandle } from '../../../components/ui';
import { colors } from '../../../lib/theme';
import { SCREEN_PAD } from '../../../lib/quiet';

/**
 * Data & privacy screen — port of web's PrivacyPanel (LIF-188 → LIF-203):
 * the destructive delete-account flow behind an orange danger card. The
 * deletion itself is only reachable through the sheet's double confirm.
 */
export default function PrivacyScreen() {
  const deleteSheetRef = useRef<OpenableSheetHandle>(null);

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Data & privacy" />
      <Card style={styles.dangerCard}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <AppText variant="headline" style={styles.title}>Delete account</AppText>
            <AppText variant="footnote" style={styles.subtitle}>Permanently remove your account and all data.</AppText>
          </View>
          <Button
            title="Delete"
            variant="destructive"
            size="sm"
            onPress={() => deleteSheetRef.current?.open()}
          />
        </View>
      </Card>

      {/* Always mounted; the sheet clears its own fields in open() and onDismiss. */}
      <DeleteAccountSheet ref={deleteSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: SCREEN_PAD, paddingVertical: 16 },
  // Web PrivacyPanel: 1.5px brand-orange border marks the danger zone.
  dangerCard: {
    marginTop: 24,
    borderWidth: hairline,
    borderColor: colors.brandOrange,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  rowText: { flex: 1, minWidth: 0 },
  title: { color: colors.brandOrange },
  subtitle: {
    marginTop: 4,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
