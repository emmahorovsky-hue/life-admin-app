import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
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
import { updateProfile } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors } from '../../lib/theme';

/** RN port of web's EditNameDialog (client/src/components/settings/), as a sheet. */
export const EditNameSheet = forwardRef<OpenableSheetHandle>(function EditNameSheet(_props, ref) {
  const sheet = useRef<FormSheetHandle>(null);
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The sheet is mounted for the life of the screen, so unlike the dialog this
  // replaced there is no per-open remount to seed state. `open()` is the one
  // place that happens — no dep array, so it always closes over a fresh `user`.
  useImperativeHandle(ref, () => ({
    open: () => {
      setName(user?.name ?? '');
      setSurname(user?.surname ?? '');
      setError('');
      setLoading(false);
      sheet.current?.open();
    },
  }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await updateProfile({
        name: name.trim() || undefined,
        surname: surname.trim() || undefined,
      });
      updateUser(res.data.user);
      // Dismiss before the toast — the toast host renders beneath the sheet portal.
      sheet.current?.close();
      toast.success('Name updated');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update your name. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormSheet
      ref={sheet}
      title="Edit name"
      actions={
        <>
          <Button title="Save" loading={loading} onPress={() => void handleSubmit()} />
          <Button
            title="Cancel"
            variant="outline"
            disabled={loading}
            onPress={() => sheet.current?.close()}
          />
        </>
      }
    >
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <FieldLabel>First name</FieldLabel>
          <SheetInput
            placeholder="First name"
            value={name}
            onChangeText={setName}
            editable={!loading}
            autoComplete="given-name"
          />
        </View>
        <View style={styles.field}>
          <FieldLabel>Last name</FieldLabel>
          <SheetInput
            placeholder="Last name"
            value={surname}
            onChangeText={setSurname}
            editable={!loading}
            autoComplete="family-name"
          />
        </View>
      </View>
      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
    </FormSheet>
  );
});

const styles = StyleSheet.create({
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  error: { marginTop: spacing.md, color: colors.destructive },
});
