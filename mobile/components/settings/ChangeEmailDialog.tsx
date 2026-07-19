import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AppDialog, Button, FieldLabel, Input, useToast } from '../ui';
import { initiateEmailChange } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors, fontMono } from '../../lib/theme';

interface ChangeEmailDialogProps {
  visible: boolean;
  onClose: () => void;
}

/** RN port of web's ChangeEmailDialog (client/src/components/settings/). */
export function ChangeEmailDialog({ visible, onClose }: ChangeEmailDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  // Mounted only while open (see AccountScreen), so state starts fresh per open.
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!newEmail.trim()) {
      setError('Enter a new email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await initiateEmailChange({ email: newEmail.trim() });
      toast.success('Confirmation email sent — check your inbox.');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send confirmation email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title="Change email"
      footer={
        <>
          <Button title="Cancel" variant="outline" disabled={loading} onPress={onClose} />
          <Button title="Send confirmation" loading={loading} onPress={handleSubmit} />
        </>
      }
    >
      <Text style={styles.current}>
        Current: <Text style={styles.currentEmail}>{user?.email}</Text>
      </Text>
      <View style={styles.field}>
        <FieldLabel>New email address</FieldLabel>
        <Input
          placeholder="Enter new email"
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <Text style={styles.hint}>
          A confirmation link will be sent to the new address. Your email won't change until you
          open it.
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  current: { fontSize: 13, color: colors.mutedForeground },
  currentEmail: { fontFamily: fontMono, color: colors.foreground },
  field: { marginTop: spacing.lg },
  hint: { marginTop: spacing.sm, fontSize: 12, color: colors.mutedForeground },
  error: { marginTop: spacing.md, fontSize: 13, color: colors.destructive },
});
