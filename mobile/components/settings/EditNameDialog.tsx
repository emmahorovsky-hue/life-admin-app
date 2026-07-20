import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { AppDialog, AppText, Button, FieldLabel, Input, useToast } from '../ui';
import { updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors } from '../../lib/theme';

interface EditNameDialogProps {
  visible: boolean;
  onClose: () => void;
}

/** RN port of web's EditNameDialog (client/src/components/settings/). */
export function EditNameDialog({ visible, onClose }: EditNameDialogProps) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  // AccountScreen mounts this dialog only while open, so the initializers seed
  // fresh values on every open — no reset effect needed.
  const [name, setName] = useState(user?.name ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await updateProfile({
        name: name.trim() || undefined,
        surname: surname.trim() || undefined,
      });
      updateUser(res.data.user);
      toast.success('Name updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update your name. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title="Edit name"
      footer={
        <>
          <Button title="Cancel" variant="outline" disabled={loading} onPress={onClose} />
          <Button title="Save" loading={loading} onPress={handleSubmit} />
        </>
      }
    >
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <FieldLabel>First name</FieldLabel>
          <Input
            placeholder="First name"
            value={name}
            onChangeText={setName}
            editable={!loading}
            autoComplete="given-name"
          />
        </View>
        <View style={styles.field}>
          <FieldLabel>Last name</FieldLabel>
          <Input
            placeholder="Last name"
            value={surname}
            onChangeText={setSurname}
            editable={!loading}
            autoComplete="family-name"
          />
        </View>
      </View>
      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  error: { marginTop: spacing.md, color: colors.destructive },
});
