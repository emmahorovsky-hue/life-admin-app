import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { isValidPassword, spacing } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';
import { Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
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
        <Text style={styles.body}>
          This password reset link is invalid or incomplete. Please request a new one.
        </Text>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Request a new link
        </Link>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.container}>
        <ScreenTitle style={styles.title}>Password updated</ScreenTitle>
        <Text style={styles.body}>Your password has been reset. You can now sign in.</Text>
        <Button
          title="Go to Sign In"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.button}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle style={styles.title}>Reset password</ScreenTitle>
      <Text style={styles.body}>Choose a new password for your account.</Text>

      <View style={styles.field}>
        <FieldLabel>New password</FieldLabel>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Text style={styles.hint}>
          Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 symbol.
        </Text>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Reset Password"
        onPress={handleSubmit}
        loading={loading}
        style={styles.button}
      />

      <Link href="/(auth)/login" style={styles.link}>
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
  body: {
    fontFamily: fonts.sans.regular,
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.md },
  hint: {
    fontFamily: fonts.sans.regular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  error: {
    fontFamily: fonts.sans.regular,
    fontSize: 14,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  button: { marginTop: spacing.sm },
  link: {
    fontFamily: fonts.sans.semibold,
    fontSize: 14,
    color: colors.brandOrange,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
