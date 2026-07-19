import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { spacing } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';
import { Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(app)/');
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error?.message;
      setError(msg || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenTitle style={styles.title}>Sign in</ScreenTitle>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

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
          autoComplete="current-password"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Sign In" onPress={handleLogin} loading={loading} style={styles.button} />

      <Link href="/(auth)/forgot-password" style={styles.linkSecondary}>
        Forgot password?
      </Link>
      <Link href="/(auth)/register" style={styles.linkPrimary}>
        Don't have an account? Sign up
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
  title: { marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  notice: {
    fontFamily: fonts.sans.regular,
    fontSize: 14,
    color: colors.success,
    marginBottom: spacing.lg,
  },
  error: {
    fontFamily: fonts.sans.regular,
    fontSize: 14,
    color: colors.destructive,
    marginBottom: spacing.md,
  },
  button: { marginTop: spacing.sm },
  linkSecondary: {
    fontFamily: fonts.sans.medium,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  linkPrimary: {
    fontFamily: fonts.sans.semibold,
    fontSize: 14,
    color: colors.brandOrange,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
