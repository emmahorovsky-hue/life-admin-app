import { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@life-admin/shared';
import { useAuth } from '../../../contexts/AuthContext';
import { AvatarTile } from '../../../components/settings/AvatarTile';
import { AppText, Card, ScreenTitle } from '../../../components/ui';
import { colors } from '../../../lib/theme';
import { SCREEN_PAD } from '../../../lib/quiet';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  href: '/profile/account' | '/profile/notifications' | '/profile/privacy';
  label: string;
  icon: IconName;
  orange?: boolean;
}

// Web SettingsIndex's menu minus Appearance — theme is deferred with mobile
// dark mode; default currency lives in the Account panel (LIF-200 decision).
const menuItems: MenuItem[] = [
  { href: '/profile/account', label: 'Account', icon: 'person-outline', orange: true },
  { href: '/profile/notifications', label: 'Notifications', icon: 'notifications-outline' },
  { href: '/profile/privacy', label: 'Data & privacy', icon: 'warning-outline', orange: true },
];

/**
 * Dotted row separator. Same iOS quirk as Perforation: borderStyle only renders
 * non-solid when drawn on all four edges, so clip a 4-side dotted box to its
 * top edge.
 */
function DottedRule() {
  return (
    <View style={styles.ruleClip}>
      <View style={styles.ruleDots} />
    </View>
  );
}

/** Settings index (design 1D drill-down) — port of web's SettingsIndex. */
export default function SettingsIndexScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle>Settings</ScreenTitle>

      {/* Identity block — avatar tile with upload/remove (LIF-202) */}
      <View style={styles.identity}>
        <AvatarTile size="md" />
        <View style={styles.identityText}>
          <AppText variant="headline" weight={800} numberOfLines={1} style={styles.name}>
            {displayName}
          </AppText>
          <AppText variant="monoMeta" numberOfLines={1} style={styles.email}>
            {user?.email}
          </AppText>
        </View>
      </View>

      {/* Menu list */}
      <Card padding="none" style={styles.menu} accessibilityLabel="Settings menu">
        {menuItems.map(({ href, label, icon, orange }, index) => (
          <View key={href}>
            {index > 0 && <DottedRule />}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(href)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Ionicons
                name={icon}
                size={20}
                color={orange ? colors.brandOrange : colors.mutedForeground}
              />
              <AppText variant="headline" style={styles.rowLabel}>{label}</AppText>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ))}
      </Card>

      {/* Sign out — moved from the old flat profile form */}
      <Pressable
        accessibilityRole="button"
        onPress={logout}
        style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
      >
        <AppText variant="body" weight={600} style={styles.signOutText}>Sign out</AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: SCREEN_PAD, paddingTop: SCREEN_PAD, paddingBottom: 48 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20 },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: colors.foreground },
  email: { color: colors.mutedForeground, marginTop: 2 },

  menu: { marginTop: 20 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  rowPressed: { backgroundColor: colors.secondary },
  rowLabel: { flex: 1, color: colors.foreground },

  ruleClip: { height: 1.5, overflow: 'hidden', marginHorizontal: 0 },
  ruleDots: { height: 8, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dotted' },

  signOut: {
    marginTop: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.base,
  },
  signOutText: { color: colors.destructive },
});
