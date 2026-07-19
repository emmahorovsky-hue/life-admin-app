import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import axios from 'axios';
import { spacing } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';
import { Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
import { api } from '../../lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setNetworkError(false);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.toLowerCase() });
      setSubmitted(true);
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        // Request never left the device (offline, DNS failure, etc.)
        setNetworkError(true);
      } else {
        // Server responded — always show success for anti-enumeration
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <ScreenTitle style={styles.title}>Check your email</ScreenTitle>
        <Text style={styles.body}>
          If that address is registered, you'll receive a password reset link shortly.
        </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle style={styles.title}>Forgot password</ScreenTitle>
      <Text style={styles.body}>Enter your email and we'll send you a reset link.</Text>

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

      {networkError ? (
        <Text style={styles.error}>No connection. Check your network and try again.</Text>
      ) : null}

      <Button
        title="Send reset link"
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
