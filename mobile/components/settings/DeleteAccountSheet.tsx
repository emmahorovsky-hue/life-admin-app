import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@life-admin/shared';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAccount } from '../../lib/privacy';
import { colors } from '../../lib/theme';
import { getApiErrorMessage } from '../../lib/utils';
import {
  AppText,
  Button,
  FieldLabel,
  FormSheet,
  SheetInput,
  type FormSheetHandle,
  type OpenableSheetHandle,
} from '../ui';

const CONFIRM_WORD = 'DELETE';

/**
 * Mobile port of web's DeleteAccountDialog (LIF-188 → LIF-203, moved to a sheet
 * in LIF-239): the destructive confirm is gated on the current password AND
 * typing DELETE. On success the account row is already gone server-side, so we
 * clear the local session directly — no /auth/logout round-trip — and the (app)
 * layout guard redirects to login.
 */
export const DeleteAccountSheet = forwardRef<OpenableSheetHandle>(function DeleteAccountSheet(
  _props,
  ref,
) {
  const sheet = useRef<FormSheetHandle>(null);
  const { clearSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.length > 0 && confirm === CONFIRM_WORD && !loading;

  const clear = useCallback(() => {
    setPassword('');
    setConfirm('');
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
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await deleteAccount({ password });
      // No setLoading(false) on success: clearing the session flips the (app)
      // layout guard, which unmounts this screen and the sheet with it.
      await clearSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete your account. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <FormSheet
      ref={sheet}
      title="Delete account"
      textEntry
      // Pan-down, the drag handle, backdrop tap, Android hardware back and
      // close() all refuse while the request is in flight — a deletion must not
      // be dismissed out from under the user. (Was the dialog's handleClose,
      // which only had to cover a backdrop tap and a close button.)
      locked={loading}
      onDismiss={clear}
      footer={
        <>
          <Button
            title="Cancel"
            variant="outline"
            disabled={loading}
            onPress={() => sheet.current?.close()}
          />
          <Button
            title="Delete account"
            variant="destructive"
            loading={loading}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
          />
        </>
      }
    >
      <AppText variant="body" style={styles.copy}>
        This permanently removes your account and all data — subscriptions, reminders, and
        settings. This can&apos;t be undone.
      </AppText>
      <View style={styles.field}>
        <FieldLabel>Current password</FieldLabel>
        <SheetInput
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
        <SheetInput
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
    </FormSheet>
  );
});

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
