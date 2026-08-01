import { useRef, useState } from 'react';
import { Animated, Text, StyleSheet, ScrollView, View, Pressable } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import axios from 'axios';
import { isValidPassword, spacing } from '@life-admin/shared';
import { colors, fonts, textStyles } from '../../lib/theme';
import { AppText, Button, FieldLabel, Input, ScreenTitle } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { AuthClose } from '../../components/AuthClose';
import { SCREEN_PAD } from '../../lib/quiet';

// Legal pages live on the web app; mobile opens the canonical URLs (see the
// former register screen — the sign-up form now lives here).
const TERMS_URL = 'https://paypr.live/terms';
const PRIVACY_URL = 'https://paypr.live/privacy';

type Mode = 'signin' | 'signup';

/**
 * The auth modal — sign in *and* sign up in one sheet (LIF-221). The toggle at
 * the bottom flips `mode` in place and crossfades the content, so the modal the
 * carousel presented never re-animates; only the form swaps. `?mode=signup`
 * opens it straight on the sign-up form (the onboarding "Create account" CTA).
 * Kept at the `login` route so every existing link and deep link still resolves.
 */
export default function AuthScreen() {
  const { mode: modeParam, notice } = useLocalSearchParams<{ mode?: string; notice?: string }>();
  const [mode, setMode] = useState<Mode>(modeParam === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const fade = useRef(new Animated.Value(1)).current;

  const isSignup = mode === 'signup';

  // Fade the content out, swap the mode while it's invisible, fade back in — so
  // the differing height between the two forms never shows as a jump, and the
  // sheet frame stays put. Errors don't carry across a mode switch.
  const switchTo = (next: Mode) => {
    if (next === mode || loading) return;
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setError('');
      setMode(next);
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };

  const handleSignin = async () => {
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

  const handleSignup = async () => {
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
    <View style={styles.screen}>
      <AuthClose />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fade }}>
          <ScreenTitle style={styles.title}>{isSignup ? 'Create account' : 'Sign in'}</ScreenTitle>

          {!isSignup && notice ? (
            <AppText variant="body" style={styles.notice}>{notice}</AppText>
          ) : null}

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
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            {isSignup ? (
              <AppText variant="caption" style={styles.hint}>
                Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 symbol.
              </AppText>
            ) : null}
          </View>

          {isSignup ? (
            <View style={styles.field}>
              <FieldLabel>Confirm password</FieldLabel>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          ) : null}

          {error ? <AppText variant="body" style={styles.error}>{error}</AppText> : null}

          <Button
            title={isSignup ? 'Create account' : 'Sign in'}
            onPress={isSignup ? handleSignup : handleSignin}
            loading={loading}
            style={styles.button}
          />

          {isSignup ? (
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
          ) : (
            <Link href="/(auth)/forgot-password" style={[textStyles.body, styles.linkSecondary]}>
              Forgot password?
            </Link>
          )}

          <Pressable
            onPress={() => switchTo(isSignup ? 'signin' : 'signup')}
            accessibilityRole="button"
            hitSlop={8}
          >
            <AppText variant="body" style={styles.toggle}>
              {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </AppText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: spacing.xl,
  },
  title: { marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  notice: { color: colors.success, marginBottom: spacing.lg },
  hint: { color: colors.mutedForeground, marginTop: 6 },
  error: { color: colors.destructive, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
  linkSecondary: {
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  terms: { color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.lg },
  termLink: { fontFamily: fonts.sans.medium, color: colors.mutedForeground },
  toggle: {
    fontFamily: fonts.sans.semibold,
    color: colors.brandOrange,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
