import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { isValidPassword } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { changePassword, initiateEmailChange, updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors, fontMono } from '../../lib/theme';

export default function ProfileScreen() {
  const { user, updateUser, logout } = useAuth();

  // Personal details
  const [name, setName] = useState(user?.name ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSuccess, setDetailsSuccess] = useState(false);

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleDetailsSubmit = async () => {
    setDetailsError('');
    setDetailsSuccess(false);
    setDetailsLoading(true);
    try {
      const res = await updateProfile({
        name: name.trim() || undefined,
        surname: surname.trim() || undefined,
      });
      updateUser(res.data.user);
      setDetailsSuccess(true);
    } catch (err) {
      setDetailsError(getApiErrorMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!newEmail.trim()) return setEmailError('Enter a new email address.');
    setEmailError('');
    setEmailSent(false);
    setEmailLoading(true);
    try {
      await initiateEmailChange({ email: newEmail.trim() });
      setEmailSent(true);
      setNewEmail('');
    } catch (err) {
      setEmailError(getApiErrorMessage(err, 'Failed to send confirmation email. Please try again.'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setPasswordError(
        'Password must be at least 8 characters and include an uppercase letter, number, and symbol',
      );
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>
          Profile<Text style={styles.accent}>.</Text>
        </Text>

        {/* Personal details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal details</Text>
          <View style={styles.fieldRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                editable={!detailsLoading}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor={colors.mutedForeground}
                value={surname}
                onChangeText={setSurname}
                editable={!detailsLoading}
              />
            </View>
          </View>
          {detailsError ? <Text style={styles.error}>{detailsError}</Text> : null}
          {detailsSuccess ? <Text style={styles.success}>Details updated.</Text> : null}
          <Pressable
            style={[styles.button, detailsLoading && styles.disabled]}
            disabled={detailsLoading}
            onPress={handleDetailsSubmit}
          >
            <Text style={styles.buttonText}>{detailsLoading ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>

        {/* Change email */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Email address</Text>
          <Text style={styles.mutedText}>Current: {user?.email}</Text>
          <Text style={styles.fieldLabel}>NEW EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new email"
            placeholderTextColor={colors.mutedForeground}
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!emailLoading}
          />
          <Text style={styles.hint}>
            A confirmation link will be sent to the new address. Your email won't change until you
            open it.
          </Text>
          {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
          {emailSent ? (
            <Text style={styles.success}>Check your inbox to confirm the new address.</Text>
          ) : null}
          <Pressable
            style={[styles.button, emailLoading && styles.disabled]}
            disabled={emailLoading}
            onPress={handleEmailSubmit}
          >
            <Text style={styles.buttonText}>{emailLoading ? 'Sending…' : 'Send confirmation'}</Text>
          </Pressable>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Password</Text>
          <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor={colors.mutedForeground}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoComplete="current-password"
            editable={!passwordLoading}
          />
          <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.mutedForeground}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!passwordLoading}
          />
          <Text style={styles.hint}>
            Must contain at least 8 characters, including 1 uppercase letter, 1 number, and 1
            symbol.
          </Text>
          <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor={colors.mutedForeground}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!passwordLoading}
          />
          {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
          {passwordSuccess ? <Text style={styles.success}>Password updated.</Text> : null}
          <Pressable
            style={[styles.button, passwordLoading && styles.disabled]}
            disabled={passwordLoading}
            onPress={handlePasswordSubmit}
          >
            <Text style={styles.buttonText}>
              {passwordLoading ? 'Updating…' : 'Update password'}
            </Text>
          </Pressable>
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutButton} onPress={logout}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.foreground, marginBottom: 4, marginTop: 8 },
  accent: { color: colors.brandOrange },

  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: {
    fontFamily: fontMono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.mutedForeground,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.foreground,
  },
  hint: { fontSize: 12, color: colors.mutedForeground, marginTop: 6 },
  mutedText: { fontSize: 13, color: colors.mutedForeground },
  error: { color: colors.destructive, fontSize: 13, marginTop: 10 },
  success: { color: colors.success, fontSize: 13, marginTop: 10 },

  button: {
    backgroundColor: colors.foreground,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 14,
  },
  buttonText: { color: colors.background, fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.6 },

  signOutButton: {
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  signOutText: { color: colors.destructive, fontWeight: '600', fontSize: 14 },
});
