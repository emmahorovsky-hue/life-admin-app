import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isValidPassword, spacing } from '@life-admin/shared';
import {
  AppText,
  Button,
  FieldLabel,
  FormSheet,
  SheetInput,
  useToast,
  type FormSheetHandle,
  type OpenableSheetHandle,
} from '../ui';
import { changePassword } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors } from '../../lib/theme';

/** RN port of web's ChangePasswordDialog (client/src/components/settings/), as a sheet. */
export const ChangePasswordSheet = forwardRef<OpenableSheetHandle>(function ChangePasswordSheet(
  _props,
  ref,
) {
  const sheet = useRef<FormSheetHandle>(null);
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The dialog this replaced was mounted only while open, so the three
  // plaintext passwords died with it. A sheet lives as long as the screen, so
  // clear them explicitly rather than leaving them in memory behind a settings
  // tab. Done on dismiss *and* on open: dismissal is not guaranteed to have run
  // (the screen can unmount with the sheet still up).
  const clear = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  }, []);

  useImperativeHandle(ref, () => ({
    open: () => {
      clear();
      setLoading(false);
      sheet.current?.open();
    },
  }));

  const handleSubmit = async () => {
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(
        'Password must be at least 8 characters and include an uppercase letter, number, and symbol',
      );
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      // Dismiss before the toast — the toast host renders beneath the sheet portal.
      sheet.current?.close();
      toast.success('Password updated');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormSheet
      ref={sheet}
      title="Change password"
      onDismiss={clear}
      actions={
        <>
          <Button title="Update password" loading={loading} onPress={() => void handleSubmit()} />
          <Button
            title="Cancel"
            variant="outline"
            disabled={loading}
            onPress={() => sheet.current?.close()}
          />
        </>
      }
    >
      <View>
        <FieldLabel>Current password</FieldLabel>
        <SheetInput
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
          editable={!loading}
        />
      </View>
      <View style={styles.field}>
        <FieldLabel>New password</FieldLabel>
        <SheetInput
          placeholder="At least 8 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />
        <AppText variant="caption" style={styles.hint}>
          At least 8 characters, including 1 uppercase letter, 1 number, and 1 symbol.
        </AppText>
      </View>
      <View style={styles.field}>
        <FieldLabel>Confirm new password</FieldLabel>
        <SheetInput
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />
      </View>
      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
    </FormSheet>
  );
});

const styles = StyleSheet.create({
  field: { marginTop: spacing.lg },
  hint: { marginTop: spacing.sm, color: colors.mutedForeground },
  error: { marginTop: spacing.md, color: colors.destructive },
});
