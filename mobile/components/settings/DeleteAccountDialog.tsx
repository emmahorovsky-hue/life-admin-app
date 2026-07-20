import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAccount } from '../../lib/privacy';
import { colors } from '../../lib/theme';
import { getApiErrorMessage } from '../../lib/utils';
import { AppDialog, AppText, Button, FieldLabel, Input } from '../ui';

interface DeleteAccountDialogProps {
  visible: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = 'DELETE';

/**
 * Mobile port of web's DeleteAccountDialog (LIF-188 → LIF-203): the
 * destructive confirm is gated on the current password AND typing DELETE.
 * On success the account row is already gone server-side, so we clear the
 * local session directly — no /auth/logout round-trip — and the (app) layout
 * guard redirects to login.
 */
export function DeleteAccountDialog({ visible, onClose }: DeleteAccountDialogProps) {
  const { clearSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.length > 0 && confirm === CONFIRM_WORD && !loading;

  // Backdrop tap, close button and hardware back all route through here — a
  // deletion in flight must not be dismissed out from under the user.
  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await deleteAccount({ password });
      // No setLoading(false) on success: clearing the session flips the (app)
      // layout guard, which unmounts this screen and lands on login.
      await clearSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete your account. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={handleClose}
      title="Delete account"
      footer={
        <>
          <Button title="Cancel" variant="outline" onPress={handleClose} disabled={loading} />
          <Button
            title="Delete account"
            variant="destructive"
            loading={loading}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        </>
      }
    >
      <AppText variant="body" style={styles.copy}>
        This permanently removes your account and all data — subscriptions, reminders, and
        settings. This can't be undone.
      </AppText>
      <View style={styles.field}>
        <FieldLabel>Current password</FieldLabel>
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Enter current password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!loading}
        />
      </View>
      <View style={styles.field}>
        <FieldLabel>Type {CONFIRM_WORD} to confirm</FieldLabel>
        <Input
          value={confirm}
          onChangeText={setConfirm}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          editable={!loading}
        />
      </View>
      {error ? (
        <AppText variant="footnote" weight={500} accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  copy: {
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  field: { marginTop: spacing.lg },
  error: {
    marginTop: spacing.md,
    color: colors.destructive,
  },
});
