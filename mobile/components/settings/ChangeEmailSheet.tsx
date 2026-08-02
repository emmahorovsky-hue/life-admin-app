import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { initiateEmailChange } from '../../lib/profile';
import { getApiErrorMessage } from '../../lib/utils';
import { colors, fontMono } from '../../lib/theme';

/** RN port of web's ChangeEmailDialog (client/src/components/settings/), as a sheet. */
export const ChangeEmailSheet = forwardRef<OpenableSheetHandle>(function ChangeEmailSheet(
  _props,
  ref,
) {
  const sheet = useRef<FormSheetHandle>(null);
  const { user } = useAuth();
  const toast = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Always mounted, so state is seeded here rather than by a remount per open.
  useImperativeHandle(ref, () => ({
    open: () => {
      setNewEmail('');
      setError('');
      setLoading(false);
      sheet.current?.open();
    },
  }));

  const handleSubmit = async () => {
    if (!newEmail.trim()) {
      setError('Enter a new email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await initiateEmailChange({ email: newEmail.trim() });
      // Dismiss before the toast — the toast host renders beneath the sheet portal.
      sheet.current?.close();
      toast.success('Confirmation email sent — check your inbox.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send confirmation email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormSheet
      ref={sheet}
      title="Change email"
      actions={
        <>
          <Button
            title="Send confirmation"
            loading={loading}
            onPress={() => void handleSubmit()}
          />
          <Button
            title="Cancel"
            variant="outline"
            disabled={loading}
            onPress={() => sheet.current?.close()}
          />
        </>
      }
    >
      <AppText variant="footnote" style={styles.current}>
        Current: <Text style={styles.currentEmail}>{user?.email}</Text>
      </AppText>
      <View style={styles.field}>
        <FieldLabel>New email address</FieldLabel>
        <SheetInput
          placeholder="Enter new email"
          value={newEmail}
          onChangeText={setNewEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <AppText variant="caption" style={styles.hint}>
          A confirmation link will be sent to the new address. Your email won&apos;t change until you
          open it.
        </AppText>
      </View>
      {error ? <AppText variant="footnote" style={styles.error}>{error}</AppText> : null}
    </FormSheet>
  );
});

const styles = StyleSheet.create({
  current: { color: colors.mutedForeground },
  currentEmail: { fontFamily: fontMono, color: colors.foreground },
  field: { marginTop: spacing.lg },
  hint: { marginTop: spacing.sm, color: colors.mutedForeground },
  error: { marginTop: spacing.md, color: colors.destructive },
});
