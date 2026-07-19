import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';

/**
 * Detail-screen header for the settings drill-down — port of web
 * SettingsShell's mobile branch: 44px row, absolute-left icon-only back
 * chevron, centered 17px extrabold title + brand-orange period.
 */
export function SettingsDetailHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to settings"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
        <Text style={styles.accent}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    left: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.base,
  },
  backPressed: { backgroundColor: colors.secondary },
  title: {
    fontFamily: fonts.sans.extrabold,
    fontSize: 17,
    color: colors.foreground,
  },
  accent: { color: colors.brandOrange },
});
