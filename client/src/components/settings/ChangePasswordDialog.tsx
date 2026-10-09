import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordRequirements } from '@/components/ui/password-requirements';
import { useConfirmPassword } from '@/hooks/useConfirmPassword';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { isValidPassword } from '@life-admin/shared';
import { SettingsDialog } from './SettingsDialog';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  // Mounted only while open (see AccountPanel), so state starts fresh per open.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const confirm = useConfirmPassword(newPassword, confirmPassword);
  const passwordInvalid = submitted && !isValidPassword(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Both problems show on their own fields; the error line is for the server.
    setSubmitted(true);
    confirm.reveal();
    if (!isValidPassword(newPassword) || confirm.mismatch) return;

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success('Password updated');
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change password"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={loading}
            aria-invalid={passwordInvalid || undefined}
            aria-describedby="new-password-requirements"
          />
          <PasswordRequirements id="new-password-requirements" password={newPassword} showErrors={passwordInvalid} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            {...confirm.confirmProps}
          />
          {confirm.error && (
            <p id={confirm.errorId} className="text-xs text-destructive">
              {confirm.error}
            </p>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </SettingsDialog>
  );
}
