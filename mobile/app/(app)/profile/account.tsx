import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { hairline, radius, spacing } from '@life-admin/shared';
import { useAuth } from '../../../contexts/AuthContext';
import { AvatarTile } from '../../../components/settings/AvatarTile';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { EditNameSheet } from '../../../components/settings/EditNameSheet';
import { ChangeEmailSheet } from '../../../components/settings/ChangeEmailSheet';
import { ChangePasswordSheet } from '../../../components/settings/ChangePasswordSheet';
import {
  DefaultCurrencySheet,
  DefaultCurrencySheetHandle,
} from '../../../components/settings/DefaultCurrencySheet';
import {
  AppText,
  Button,
  Card,
  Switch,
  useToast,
  type OpenableSheetHandle,
} from '../../../components/ui';
import { IconCheck } from '../../../components/icons';
import { colors } from '../../../lib/theme';
import { SCREEN_PAD } from '../../../lib/quiet';
import { useTabBarInset } from '../../../lib/useTabBarInset';
import {
  biometricPref,
  getLabel,
  isAvailable,
  setQuickUnlock,
  type BiometricLabel,
} from '../../../lib/biometrics';
import { tokenStorage } from '../../../lib/storage';

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
/**
 * Biometric quick-unlock toggle state (LIF-222).
 *
 * iOS only for now. SecureStore's `requireAuthentication` is supported on
 * Android too, but with different semantics — it prompts on writes as well as
 * reads, so merely enabling the setting would trigger a prompt. That needs its
 * own pass; the row stays hidden there rather than shipping a half-behaviour.
 */
function useBiometricUnlock(userId: string | undefined) {
  const toast = useToast();
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState<BiometricLabel>('Face ID');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !userId) return;
    let isMounted = true;
    void (async () => {
      const [can, name, pref] = await Promise.all([
        isAvailable(),
        getLabel(),
        biometricPref.get(userId),
      ]);
      // Trust storage over the preference: if the pref says on but the token is
      // not actually gated (enrolment removed, or a failed migration), the
      // switch must show the truth rather than imply a protection that is absent.
      const on = can && pref && (await tokenStorage.isProtected());
      if (!isMounted) return;
      setAvailable(can);
      setLabel(name);
      setEnabled(on);
    })();
    return () => { isMounted = false; };
  }, [userId]);

  const toggle = async (next: boolean) => {
    if (!userId) return;
    setSaving(true);
    try {
      // Shared with the post-sign-in offer (lib/biometrics.ts) so the gated
      // token and the stored preference can never be written by one path and
      // not the other. The confirm-before-enabling prompt lives in there too.
      const result = await setQuickUnlock(userId, next, label);
      if (result === 'cancelled') return;
      if (result === 'no-session') {
        toast.error('Could not update the setting — please sign in again.');
        return;
      }
      if (result === 'error') {
        toast.error('Could not update the setting. Please try again.');
        return;
      }
      setEnabled(next);
      toast.success(next ? `${label} unlock is on.` : `${label} unlock is off.`);
    } finally {
      setSaving(false);
    }
  };

  return { show: available, label, enabled, saving, toggle };
}

export default function AccountScreen() {
  const { user } = useAuth();
  const tabBarInset = useTabBarInset();
  const nameSheetRef = useRef<OpenableSheetHandle>(null);
  const emailSheetRef = useRef<OpenableSheetHandle>(null);
  const passwordSheetRef = useRef<OpenableSheetHandle>(null);
  const currencySheetRef = useRef<DefaultCurrencySheetHandle>(null);
  const biometric = useBiometricUnlock(user?.id);

  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;
  const passwordSubtitle = user?.passwordChangedAt
    ? `Last changed ${formatDistanceToNow(new Date(user.passwordChangedAt), { addSuffix: true })}.`
    : 'Never changed.';

  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Account" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarInset }]}>
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
            <Button
              title="Edit"
              variant="outline"
              size="sm"
              onPress={() => nameSheetRef.current?.open()}
            />
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
                  <IconCheck size={11} color={colors.success} />
                  <AppText variant="monoLabel" style={styles.badgeText}>VERIFIED</AppText>
                </View>
              )}
            </View>
            <Button
              title="Change"
              variant="outline"
              size="sm"
              onPress={() => emailSheetRef.current?.open()}
            />
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
              onPress={() => passwordSheetRef.current?.open()}
            />
          </View>

          {/* Next to the password row because it is a credential setting, and
              mobile's settings index has no Security panel to put it in yet.
              Hidden outright without enrolled biometrics — a disabled switch
              would raise a question the screen cannot answer. */}
          {biometric.show && (
            <>
              <DottedRule />
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <AppText variant="body" weight={600} style={styles.rowTitle}>
                    Unlock with {biometric.label}
                  </AppText>
                  <AppText variant="footnote" style={styles.rowSubtitle}>
                    Open Paypr without typing your password.
                  </AppText>
                </View>
                <Switch
                  checked={biometric.enabled}
                  onCheckedChange={biometric.toggle}
                  disabled={biometric.saving}
                />
              </View>
            </>
          )}

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

      {/* Ref-driven and always mounted. Each sheet seeds its own form state in
          open(), which is what the conditional mounting used to give for free. */}
      <EditNameSheet ref={nameSheetRef} />
      <ChangeEmailSheet ref={emailSheetRef} />
      <ChangePasswordSheet ref={passwordSheetRef} />
      <DefaultCurrencySheet ref={currencySheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: SCREEN_PAD, paddingVertical: spacing.lg },
  // paddingBottom is applied dynamically via useTabBarInset to clear the glass tab bar.
  content: { paddingTop: spacing.lg, gap: spacing.lg },

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
