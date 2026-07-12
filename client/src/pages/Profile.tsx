import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateProfile, changePassword, initiateEmailChange } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { isValidPassword } from '@life-admin/shared';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const emailChanged = searchParams.get('emailChanged') === 'true';
  const tokenError = searchParams.get('error') === 'invalid-token';
  const emailTakenError = searchParams.get('error') === 'email-taken';

  // Clear query params from URL after reading them (runs once per param presence)
  useEffect(() => {
    if (searchParams.get('emailChanged') || searchParams.get('error')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Personal details
  const [name, setName] = useState(user?.name ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSuccess, setDetailsSuccess] = useState(false);

  // Notifications
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState('');

  const handleReminderEmailsToggle = async (enabled: boolean) => {
    setRemindersError('');
    setRemindersLoading(true);
    try {
      const res = await updateProfile({ reminderEmailsEnabled: enabled });
      updateUser(res.data.user);
    } catch (err) {
      setRemindersError(getApiErrorMessage(err, 'Failed to update reminder settings. Please try again.'));
    } finally {
      setRemindersLoading(false);
    }
  };

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError('');
    setDetailsSuccess(false);
    setDetailsLoading(true);
    try {
      const res = await updateProfile({ name: name.trim() || undefined, surname: surname.trim() || undefined });
      updateUser(res.data.user);
      setDetailsSuccess(true);
    } catch (err) {
      setDetailsError(getApiErrorMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSent(false);
    setEmailLoading(true);
    try {
      await initiateEmailChange({ email: newEmail });
      setEmailSent(true);
      setNewEmail('');
    } catch (err) {
      setEmailError(getApiErrorMessage(err, 'Failed to send confirmation email. Please try again.'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setPasswordError('Password must be at least 8 characters and include an uppercase letter, number, and symbol');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-3xl font-bold">Profile<span className="text-brand-orange">.</span></h2>
      </div>

      {emailChanged && (
        <div className="text-sm bg-green-50 text-green-800 border border-green-200 p-3 rounded-md">
          Your email address has been updated successfully.
        </div>
      )}
      {tokenError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
          That confirmation link is invalid or has expired. Please request a new one.
        </div>
      )}
      {emailTakenError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
          That email address is now in use by another account. Please try a different address.
        </div>
      )}

      {/* Personal details */}
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">First name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="First name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={detailsLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Last name</Label>
                <Input
                  id="surname"
                  type="text"
                  placeholder="Last name"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  disabled={detailsLoading}
                />
              </div>
            </div>
            {detailsError && (
              <p className="text-sm text-destructive">{detailsError}</p>
            )}
            {detailsSuccess && (
              <p className="text-sm text-green-700">Details updated.</p>
            )}
            <Button type="submit" disabled={detailsLoading}>
              {detailsLoading ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="reminderEmails">Renewal reminder emails</Label>
              <p className="text-xs text-muted-foreground">
                A heads-up email before each subscription renews, so you can cancel in time. You can also mute individual subscriptions when editing them.
              </p>
            </div>
            <Switch
              id="reminderEmails"
              checked={user?.reminderEmailsEnabled ?? true}
              onCheckedChange={handleReminderEmailsToggle}
              disabled={remindersLoading}
            />
          </div>
          {remindersError && (
            <p className="text-sm text-destructive mt-3">{remindersError}</p>
          )}
        </CardContent>
      </Card>

      {/* Change email */}
      <Card>
        <CardHeader>
          <CardTitle>Email address</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Current: {user?.email}</p>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email address</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="Enter new email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                disabled={emailLoading}
              />
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to the new address. Your email won't change until you click it.
              </p>
            </div>
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
            {emailSent && (
              <p className="text-sm text-green-700">Check your inbox to confirm the new address.</p>
            )}
            <Button type="submit" disabled={emailLoading}>
              {emailLoading ? 'Sending...' : 'Send confirmation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={passwordLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={passwordLoading}
              />
              <p className="text-xs text-muted-foreground">
                Must contain at least 8 characters, including 1 uppercase letter, 1 number, and 1 symbol.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={passwordLoading}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-700">Password updated.</p>
            )}
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
