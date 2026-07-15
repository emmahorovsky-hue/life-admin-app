import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';

interface EditNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditNameDialog({ open, onOpenChange }: EditNameDialogProps) {
  const { user, updateUser } = useAuth();
  // AccountPanel mounts this dialog only while open, so the initializers seed
  // fresh values on every open — no reset effect needed.
  const [name, setName] = useState(user?.name ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await updateProfile({ name: name.trim() || undefined, surname: surname.trim() || undefined });
      updateUser(res.data.user);
      toast.success('Name updated');
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update your name. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit name"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-name">First name</Label>
          <Input
            id="edit-name"
            type="text"
            placeholder="First name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-surname">Last name</Label>
          <Input
            id="edit-surname"
            type="text"
            placeholder="Last name"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </SettingsDialog>
  );
}
