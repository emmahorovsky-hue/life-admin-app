import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { AppText, Card, Switch, useToast } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { updateProfile } from '../../../lib/profile';
import { colors } from '../../../lib/theme';
import { getApiErrorMessage } from '../../../lib/utils';
import { usePushPermission } from '../../../lib/usePushPermission';
import { SCREEN_PAD } from '../../../lib/quiet';

/**
 * Notifications screen — port of web's NotificationsPanel (LIF-185 → LIF-203),
 * extended with the push channel.
 *
 * Two controls, one per delivery channel. Timing is cycle-aware on the server
 * (weekly 1d … annual 14d — see docs/design/renewal-reminders-strategy.md), so
 * there is still no user-set "remind me N days" here; per-subscription mutes
 * live in the subscription edit form.
 *
 * The channels are independent by design: neither is a fallback for the other,
 * so both can be on, either can be off, and turning one off says nothing about
 * the other.
 */
export default function NotificationsScreen() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState<'email' | 'push' | null>(null);
  const osGranted = usePushPermission();

  // Both switches reflect server state and only move once the save succeeds,
  // so a failed request needs no rollback.
  const emailEnabled = user?.reminderEmailsEnabled ?? true;
  const pushEnabled = user?.reminderPushEnabled ?? true;

  const save = async (
    channel: 'email' | 'push',
    patch: { reminderEmailsEnabled?: boolean; reminderPushEnabled?: boolean },
    next: boolean
  ) => {
    setSaving(channel);
    try {
      const res = await updateProfile(patch);
      updateUser(res.data.user);
      const label = channel === 'email' ? 'Email reminders' : 'Push notifications';
      toast.success(next ? `${label} turned on.` : `${label} turned off.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update reminder settings. Please try again.'));
    } finally {
      setSaving(null);
    }
  };

  // Permission denied at the OS level means nothing can arrive no matter what
  // the server thinks, so the switch would be a lie. Show the way to fix it
  // instead of a control that silently does nothing.
  const pushBlocked = osGranted === false;

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Notifications" />
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <AppText variant="headline" style={styles.rowTitle}>Email reminders</AppText>
            <AppText variant="footnote" style={styles.rowSubtitle}>A heads-up before a subscription renews.</AppText>
          </View>
          {/* Only the channel actually in flight locks — `saving` already
              tracks which one, and greying out the other implies the two
              settings are coupled when the whole point is that they aren't. */}
          <Switch
            checked={emailEnabled}
            onCheckedChange={(next) => save('email', { reminderEmailsEnabled: next }, next)}
            disabled={saving === 'email'}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <AppText variant="headline" style={styles.rowTitle}>Push notifications</AppText>
            <AppText variant="footnote" style={styles.rowSubtitle}>
              {pushBlocked
                ? 'Blocked in your device settings.'
                : 'The same heads-up, on this device.'}
            </AppText>
          </View>
          {pushBlocked ? (
            <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
              <AppText variant="footnote" weight={500} style={styles.settingsLink}>Settings</AppText>
            </Pressable>
          ) : (
            <Switch
              checked={pushEnabled}
              onCheckedChange={(next) => save('push', { reminderPushEnabled: next }, next)}
              disabled={saving === 'push'}
            />
          )}
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  settingsLink: { color: colors.brandOrange },
  explainer: {
    marginTop: spacing.lg,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
