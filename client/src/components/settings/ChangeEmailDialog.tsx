import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initiateEmailChange } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailDialog({ open, onOpenChange }: ChangeEmailDialogProps) {
  const { user } = useAuth();
  // Mounted only while open (see AccountPanel), so state starts fresh per open.
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await initiateEmailChange({ email: newEmail });
      toast.success('Confirmation email sent — check your inbox.');
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send confirmation email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change email"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send confirmation'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Current: <span className="font-mono text-foreground">{user?.email}</span>
      </p>
      <div className="mt-4 space-y-2">
        <Label htmlFor="new-email">New email address</Label>
        <Input
          id="new-email"
          type="email"
          placeholder="Enter new email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          A confirmation link will be sent to the new address. Your email won't change until you click it.
        </p>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </SettingsDialog>
  );
}
