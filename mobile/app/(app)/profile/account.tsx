import { StyleSheet, Text, View } from 'react-native';
import { SettingsDetailHeader } from '../../../components/settings/SettingsDetailHeader';
import { colors, fontMono } from '../../../lib/theme';

// Stub — the account panel (name/email/password dialogs + default currency)
// lands in LIF-201.
export default function AccountScreen() {
  return (
    <View style={styles.screen}>
      <SettingsDetailHeader title="Account" />
      <Text style={styles.placeholder}>COMING SOON</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
  placeholder: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
  },
});
