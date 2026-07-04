import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { isValidPassword } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';

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
    } catch (err: unknown) {
      const msg =
        err instanceof Error && (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(msg || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />
      <Text style={styles.hint}>
        Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 symbol.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleRegister} disabled={loading} style={styles.button}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </Pressable>

      <Text style={styles.terms}>
        By signing up, you agree to our{' '}
        <Text style={styles.termLink}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.termLink}>Privacy Policy</Text>.
      </Text>

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  error: { color: '#ef4444', marginBottom: 12 },
  button: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  terms: { marginTop: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 },
  termLink: { color: '#3b82f6' },
  link: { marginTop: 16, textAlign: 'center', color: '#3b82f6' },
});
