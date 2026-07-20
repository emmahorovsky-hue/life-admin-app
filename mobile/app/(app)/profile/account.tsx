import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { hairline, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../../contexts/AuthContext';
import { AvatarTile } from '../../../components/settings/AvatarTile';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { EditNameDialog } from '../../../components/settings/EditNameDialog';
import { ChangeEmailDialog } from '../../../components/settings/ChangeEmailDialog';
import { ChangePasswordDialog } from '../../../components/settings/ChangePasswordDialog';
import {
  DefaultCurrencySheet,
  DefaultCurrencySheetHandle,
} from '../../../components/settings/DefaultCurrencySheet';
import { AppText, Button, Card } from '../../../components/ui';
import { colors } from '../../../lib/theme';

type AccountModal = null | 'name' | 'email' | 'password';

/**
 * Dotted row separator — same iOS quirk as Perforation: borderStyle only
 * renders non-solid when drawn on all four edges, so clip a 4-side dotted box
 * to its top edge (pattern from profile/index.tsx).
 */
function DottedRule() {
  return (
    <View style={styles.ruleClip}>
      <View style={styles.ruleDots} />
    </View>
  );
}

/**
 * Account panel (LIF-201) — port of web's AccountPanel
 * (client/src/pages/settings/AccountPanel.tsx): profile card + details rows
 * opening name/email/password dialogs, plus the default-currency picker that
 * web keeps in AppearancePanel (folded in here until mobile dark mode lands).
 */
export default function AccountScreen() {
  const { user } = useAuth();
  const [modal, setModal] = useState<AccountModal>(null);
  const currencySheetRef = useRef<DefaultCurrencySheetHandle>(null);

  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;
  const passwordSubtitle = user?.passwordChangedAt
    ? `Last changed ${formatDistanceToNow(new Date(user.passwordChangedAt), { addSuffix: true })}.`
    : 'Never changed.';

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Account" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <AvatarTile size="lg" />
          <View style={styles.profileText}>
            <AppText variant="title" numberOfLines={1} style={styles.profileName}>
              {displayName}
            </AppText>
            <AppText variant="monoMeta" numberOfLines={1} style={styles.profileEmail}>
              {user?.email}
            </AppText>
          </View>
        </Card>

        {/* Details card */}
        <Card padding="none" style={styles.details}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="body" weight={600} style={styles.rowTitle}>Name</AppText>
              <AppText variant="footnote" numberOfLines={1} style={styles.rowSubtitle}>
                {displayName}
              </AppText>
            </View>
            <Button title="Edit" variant="outline" size="sm" onPress={() => setModal('name')} />
          </View>

          <DottedRule />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="body" weight={600} style={styles.rowTitle}>Email address</AppText>
              <AppText variant="monoMeta" numberOfLines={1} style={styles.rowSubtitle}>
                {user?.email}
              </AppText>
              {user?.emailVerified && (
                <View style={styles.badge}>
                  <Ionicons name="checkmark" size={11} color={colors.success} />
                  <AppText variant="monoLabel" style={styles.badgeText}>VERIFIED</AppText>
                </View>
              )}
            </View>
            <Button title="Change" variant="outline" size="sm" onPress={() => setModal('email')} />
          </View>

          <DottedRule />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="body" weight={600} style={styles.rowTitle}>Password</AppText>
              <AppText variant="footnote" style={styles.rowSubtitle}>{passwordSubtitle}</AppText>
            </View>
            <Button
              title="Change password"
              variant="outline"
              size="sm"
              onPress={() => setModal('password')}
            />
          </View>

          <DottedRule />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="body" weight={600} style={styles.rowTitle}>Default currency</AppText>
              <AppText variant="monoMeta" style={styles.rowSubtitle}>
                {user?.defaultCurrency ?? 'SGD'}
              </AppText>
            </View>
            <Button
              title="Change"
              variant="outline"
              size="sm"
              onPress={() => currencySheetRef.current?.open()}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Mounted only while open so each open starts with fresh form state. */}
      {modal === 'name' && <EditNameDialog visible onClose={() => setModal(null)} />}
      {modal === 'email' && <ChangeEmailDialog visible onClose={() => setModal(null)} />}
      {modal === 'password' && <ChangePasswordDialog visible onClose={() => setModal(null)} />}

      <DefaultCurrencySheet ref={currencySheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  content: { paddingTop: spacing.lg, paddingBottom: 48, gap: spacing.lg },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: colors.foreground },
  profileEmail: { color: colors.mutedForeground, marginTop: 2 },

  details: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.foreground },
  rowSubtitle: { color: colors.mutedForeground, marginTop: 2 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.base,
  },
  badgeText: {
    letterSpacing: 0.66, // web: tracking 0.06em on 11px
    color: colors.success,
  },

  ruleClip: { height: hairline, overflow: 'hidden' },
  ruleDots: { height: 8, borderWidth: hairline, borderColor: colors.border, borderStyle: 'dotted' },
});
