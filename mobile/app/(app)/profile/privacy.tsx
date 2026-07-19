import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hairline, spacing } from '@life-admin/shared';
import { DeleteAccountDialog } from '../../../components/settings/DeleteAccountDialog';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { Button, Card } from '../../../components/ui';
import { colors, fonts } from '../../../lib/theme';

/**
 * Data & privacy screen — port of web's PrivacyPanel (LIF-188 → LIF-203):
 * the destructive delete-account flow behind an orange danger card. The
 * deletion itself is only reachable through the dialog's double confirm.
 */
export default function PrivacyScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Data & privacy" />
      <Card style={styles.dangerCard}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>Delete account</Text>
            <Text style={styles.subtitle}>Permanently remove your account and all data.</Text>
          </View>
          <Button
            title="Delete"
            variant="destructive"
            size="sm"
            onPress={() => setDialogOpen(true)}
          />
        </View>
      </Card>

      {/* Mounted only while open so the form state resets between opens (web parity). */}
      {dialogOpen && <DeleteAccountDialog visible onClose={() => setDialogOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
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
  title: { fontFamily: fonts.sans.bold, fontSize: 15, color: colors.brandOrange },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
