import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isValidPassword, spacing } from '@life-admin/shared';
import { AppDialog, AppText, Button, FieldLabel, Input, useToast } from '../ui';
import { changePassword } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors } from '../../lib/theme';

interface ChangePasswordDialogProps {
  visible: boolean;
  onClose: () => void;
}

/** RN port of web's ChangePasswordDialog (client/src/components/settings/). */
export function ChangePasswordDialog({ visible, onClose }: ChangePasswordDialogProps) {
  const toast = useToast();
  // Mounted only while open (see AccountScreen), so state starts fresh per open.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      toast.success('Password updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Button title="Cancel" variant="outline" disabled={loading} onPress={onClose} />
          <Button title="Update password" loading={loading} onPress={handleSubmit} />
        </>
      }
    >
      <View>
        <FieldLabel>Current password</FieldLabel>
        <Input
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
        <Input
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
        <Input
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />
      </View>
      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.lg },
  hint: { marginTop: spacing.sm, color: colors.mutedForeground },
  error: { marginTop: spacing.md, color: colors.destructive },
});
