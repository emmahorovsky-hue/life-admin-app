import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccount } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.length > 0 && confirm === CONFIRM_WORD && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await deleteAccount({ password });
      // The server cleared the auth cookie and the row is gone. A full document
      // navigation drops all in-memory state and lands on the public landing
      // page logged out (mirrors the Layout logout rationale).
      window.location.assign('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete your account. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete account"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={!canSubmit}>
            {loading ? 'Deleting...' : 'Delete account'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        This permanently removes your account and all data — subscriptions, reminders, and settings.
        This can't be undone.
      </p>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="delete-password">Current password</Label>
          <Input
            id="delete-password"
            type="password"
            placeholder="Enter current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            type="text"
            placeholder={CONFIRM_WORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            disabled={loading}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </SettingsDialog>
  );
}
