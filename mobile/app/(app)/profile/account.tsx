import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { getInitials, hairline, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../../contexts/AuthContext';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { EditNameDialog } from '../../../components/settings/EditNameDialog';
import { ChangeEmailDialog } from '../../../components/settings/ChangeEmailDialog';
import { ChangePasswordDialog } from '../../../components/settings/ChangePasswordDialog';
import {
  DefaultCurrencySheet,
  DefaultCurrencySheetHandle,
} from '../../../components/settings/DefaultCurrencySheet';
import { Button, Card } from '../../../components/ui';
import { colors, fontMono, fonts } from '../../../lib/theme';

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
 * The initials tile is a placeholder until the real AvatarTile (LIF-202).
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
          <View style={styles.initialsTile}>
            <Text style={styles.initialsText}>{getInitials(user)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={styles.profileName}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {user?.email}
            </Text>
          </View>
        </Card>

        {/* Details card */}
        <Card padding="none" style={styles.details}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Name</Text>
              <Text numberOfLines={1} style={styles.rowSubtitle}>
                {displayName}
              </Text>
            </View>
            <Button title="Edit" variant="outline" size="sm" onPress={() => setModal('name')} />
          </View>

          <DottedRule />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Email address</Text>
              <Text numberOfLines={1} style={[styles.rowSubtitle, styles.mono]}>
                {user?.email}
              </Text>
              {user?.emailVerified && (
                <View style={styles.badge}>
                  <Ionicons name="checkmark" size={11} color={colors.success} />
                  <Text style={styles.badgeText}>VERIFIED</Text>
                </View>
              )}
            </View>
            <Button title="Change" variant="outline" size="sm" onPress={() => setModal('email')} />
          </View>

          <DottedRule />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Password</Text>
              <Text style={styles.rowSubtitle}>{passwordSubtitle}</Text>
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
              <Text style={styles.rowTitle}>Default currency</Text>
              <Text style={[styles.rowSubtitle, styles.mono]}>
                {user?.defaultCurrency ?? 'SGD'}
              </Text>
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
  initialsTile: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.base,
    backgroundColor: colors.foreground,
  },
  initialsText: { fontFamily: fonts.sans.extrabold, fontSize: 24, color: colors.background },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontFamily: fonts.sans.extrabold, fontSize: 20, color: colors.foreground },
  profileEmail: {
    fontFamily: fontMono,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  details: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.sans.semibold, fontSize: 15, color: colors.foreground },
  rowSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  mono: { fontFamily: fontMono, fontSize: 12 },

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
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 0.66, // web: tracking 0.06em on 11px
    color: colors.success,
  },

  ruleClip: { height: hairline, overflow: 'hidden' },
  ruleDots: { height: 8, borderWidth: hairline, borderColor: colors.border, borderStyle: 'dotted' },
});
