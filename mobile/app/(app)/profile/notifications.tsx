import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { AppText, Card, Switch, useToast } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { updateProfile } from '../../../lib/profile';
import { colors } from '../../../lib/theme';
import { getApiErrorMessage } from '../../../lib/utils';
import { SCREEN_PAD } from '../../../lib/quiet';

/**
 * Notifications screen — port of web's NotificationsPanel (LIF-185 → LIF-203).
 * One control by design: the global renewal-reminders toggle. Timing is
 * cycle-aware on the server (weekly 1d … annual 14d — see
 * docs/design/renewal-reminders-strategy.md), so there is no user-set
 * "remind me N days" here; per-subscription mutes live in the subscription
 * edit form.
 */
export default function NotificationsScreen() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // The switch reflects server state and only moves once the save succeeds,
  // so a failed request needs no rollback.
  const enabled = user?.reminderEmailsEnabled ?? true;

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await updateProfile({ reminderEmailsEnabled: next });
      updateUser(res.data.user);
      toast.success(next ? 'Renewal reminders turned on.' : 'Renewal reminders turned off.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update reminder settings. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Notifications" />
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <AppText variant="headline" style={styles.rowTitle}>Renewal reminders</AppText>
            <AppText variant="footnote" style={styles.rowSubtitle}>A heads-up before a subscription renews.</AppText>
          </View>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
        </View>
        <AppText variant="footnote" style={styles.explainer}>
          Timing adjusts to each billing cycle — from a day before weekly renewals to two weeks
          before annual ones. You can also mute individual subscriptions when editing them.
        </AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: SCREEN_PAD, paddingVertical: 16 },
  card: { marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.foreground },
  rowSubtitle: {
    marginTop: 2,
    color: colors.mutedForeground,
  },
  explainer: {
    marginTop: spacing.lg,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
