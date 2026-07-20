import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { isValidPassword, spacing } from '@life-admin/shared';
import { colors, fonts, textStyles } from '../../lib/theme';
import { AppText, Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
import { api } from '../../lib/api';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setError('Both fields are required.');
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
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error?.message;
      setError(msg || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <ScreenTitle style={styles.title}>Invalid link</ScreenTitle>
        <AppText variant="body" style={styles.body}>
          This password reset link is invalid or incomplete. Please request a new one.
        </AppText>
        <Link href="/(auth)/forgot-password" style={[textStyles.body, styles.link]}>
          Request a new link
        </Link>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.container}>
        <ScreenTitle style={styles.title}>Password updated</ScreenTitle>
        <AppText variant="body" style={styles.body}>Your password has been reset. You can now sign in.</AppText>
        <Button
          title="Go to sign in"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle style={styles.title}>Reset password</ScreenTitle>
      <AppText variant="body" style={styles.body}>Choose a new password for your account.</AppText>

      <View style={styles.field}>
        <FieldLabel>New password</FieldLabel>
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
        <FieldLabel>Confirm new password</FieldLabel>
        <Input
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>

      {error ? <AppText variant="body" style={styles.error}>{error}</AppText> : null}

      <Button
        title="Reset password"
        onPress={handleSubmit}
        loading={loading}
        style={styles.button}
      />

      <Link href="/(auth)/login" style={[textStyles.body, styles.link]}>
        Back to sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { marginBottom: spacing.md },
  body: { color: colors.mutedForeground, marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  hint: { color: colors.mutedForeground, marginTop: 6 },
  error: { color: colors.destructive, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
  link: {
    fontFamily: fonts.sans.semibold,
    color: colors.brandOrange,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
