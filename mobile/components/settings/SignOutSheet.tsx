import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  AppText,
  Button,
  FormSheet,
  type FormSheetHandle,
  type OpenableSheetHandle,
} from '../ui';
import { colors } from '../../lib/theme';

/**
 * Confirm before signing out (LIF-239).
 *
 * Settings used to call `logout` straight from the row's onPress, which made an
 * account-wide action a single unguarded tap. Revocation stamps
 * `sessionsValidFrom` server-side (LIF-174), so signing out here ends the
 * session on every device the user owns — worth saying out loud before doing
 * it, and worth a confirm step at all.
 *
 * Nothing to type into — the confirm is the two buttons.
 */
export const SignOutSheet = forwardRef<OpenableSheetHandle>(function SignOutSheet(_props, ref) {
  const sheet = useRef<FormSheetHandle>(null);
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setLoading(false);
      sheet.current?.open();
    },
  }));

  // No dismiss and no setLoading(false) on the way out: logout() clears the
  // session, the (app) guard redirects to login and this screen unmounts.
  // `logout` is best-effort by design and always resolves, so there is no error
  // branch to leave the sheet sitting in a loading state.
  const handleSignOut = async () => {
    setLoading(true);
    await logout();
  };

  return (
    <FormSheet
      ref={sheet}
      title="Sign out"
      // Short request, but dismissing mid-flight would leave a UI claiming the
      // user is signed in after the server has already revoked the session.
      locked={loading}
      actions={
        <>
          <Button
            title="Sign out"
            variant="destructive"
            loading={loading}
            onPress={() => void handleSignOut()}
          />
          <Button
            title="Stay signed in"
            variant="outline"
            disabled={loading}
            onPress={() => sheet.current?.close()}
          />
        </>
      }
    >
      <AppText variant="body" style={styles.copy}>
        Signing out ends your session on every device, not just this one. You&apos;ll need your
        password to sign back in.
      </AppText>
    </FormSheet>
  );
});

const styles = StyleSheet.create({
  copy: { lineHeight: 20, color: colors.mutedForeground },
});
