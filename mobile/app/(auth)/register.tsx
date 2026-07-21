import { useState } from 'react';
import { Text, StyleSheet, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import axios from 'axios';
import { isValidPassword, spacing } from '@life-admin/shared';
import { colors, fonts, textStyles } from '../../lib/theme';
import { AppText, Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { SCREEN_PAD } from '../../lib/quiet';

// Legal pages are hosted on the marketing/web app (client `/terms`, `/privacy`);
// mobile opens the canonical URLs rather than duplicating the copy.
const TERMS_URL = 'https://paypr.live/terms';
const PRIVACY_URL = 'https://paypr.live/privacy';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 symbol.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password);
      router.replace('/(app)/');
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error?.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ScreenTitle style={styles.title}>Create account</ScreenTitle>

      <View style={styles.field}>
        <FieldLabel>Email</FieldLabel>
        <Input
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <View style={styles.field}>
        <FieldLabel>Password</FieldLabel>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <AppText variant="caption" style={styles.hint}>
          Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 symbol.
        </AppText>
      </View>

      <View style={styles.field}>
        <FieldLabel>Confirm password</FieldLabel>
        <Input
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>

      {error ? <AppText variant="body" style={styles.error}>{error}</AppText> : null}

      <Button
        title="Create account"
        onPress={handleRegister}
        loading={loading}
        style={styles.button}
      />

      <AppText variant="caption" style={styles.terms}>
        By signing up, you agree to our{' '}
        <Text
          style={styles.termLink}
          accessibilityRole="link"
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={styles.termLink}
          accessibilityRole="link"
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
        .
      </AppText>

      <Link href="/(auth)/login" style={[textStyles.body, styles.link]}>
        Already have an account? Sign in
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: spacing.xl,
  },
  title: { marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  hint: { color: colors.mutedForeground, marginTop: 6 },
  error: { color: colors.destructive, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
  terms: { color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.lg },
  termLink: { fontFamily: fonts.sans.medium, color: colors.mutedForeground },
  link: {
    fontFamily: fonts.sans.semibold,
    color: colors.brandOrange,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
