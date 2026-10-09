import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { currencies, currencyName, DEFAULT_CURRENCY } from '@life-admin/shared';
import { IconCheck } from '@/components/icons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AvatarTile } from '@/components/settings/AvatarTile';
import { EditNameDialog } from '@/components/settings/EditNameDialog';
import { ChangeEmailDialog } from '@/components/settings/ChangeEmailDialog';
import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
import { updateProfile } from '@/lib/api';
import { fullName } from '@/lib/userName';
import { getApiErrorMessage, cn } from '@/lib/utils';

type AccountModal = null | 'name' | 'email' | 'password';

export default function AccountPanel() {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<AccountModal>(null);
  const [savingCurrency, setSavingCurrency] = useState(false);

  // Moved here from Appearance (LIF-277): it decides what money looks like
  // across the account, which is not a matter of appearance. Mobile already
  // keeps it under Account.
  const handleCurrencyChange = async (defaultCurrency: string) => {
    setSavingCurrency(true);
    try {
      const res = await updateProfile({ defaultCurrency });
      updateUser(res.data.user);
      toast.success('Default currency updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update currency. Please try again.'));
    } finally {
      setSavingCurrency(false);
    }
  };

  // The email-change confirmation link redirects here with ?emailChanged=true /
  // ?error=... — surface it once as a toast, then clean the URL. The ref stops
  // StrictMode's double effect run from toasting twice.
  const paramsHandled = useRef(false);
  useEffect(() => {
    const emailChanged = searchParams.get('emailChanged') === 'true';
    const error = searchParams.get('error');
    if (!emailChanged && !error) return;

    if (!paramsHandled.current) {
      paramsHandled.current = true;
      if (emailChanged) {
        toast.success('Your email address has been updated.');
      } else if (error === 'invalid-token') {
        toast.error('That confirmation link is invalid or has expired. Please request a new one.');
      } else if (error === 'email-taken') {
        toast.error('That email address is now in use by another account. Please try a different address.');
      }
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const name = fullName(user);
  const passwordSubtitle = user?.passwordChangedAt
    ? `Last changed ${formatDistanceToNow(new Date(user.passwordChangedAt), { addSuffix: true })}.`
    : 'Never changed.';

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <section className="flex items-center gap-5 rounded-[2px] border border-border bg-white p-6 dark:bg-card">
        <AvatarTile size="lg" />
        <div className="min-w-0">
          {/* Without a name the email is the identity — shown once, not twice. */}
          <p className="truncate text-xl font-extrabold">{name ?? user?.email}</p>
          {name && <p className="truncate font-mono text-[13px] text-muted-foreground">{user?.email}</p>}
        </div>
      </section>

      {/* Details card */}
      <section className="rounded-[2px] border border-border bg-white px-6 dark:bg-card">
        <div className="border-perf flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Name</p>
            <p className={cn('truncate text-sm text-muted-foreground', !name && 'italic')}>
              {name ?? 'Add your name'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label={name ? 'Edit name' : 'Add your name'}
            onClick={() => setModal('name')}
          >
            {name ? 'Edit' : 'Add'}
          </Button>
        </div>

        <div className="border-perf flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Email address</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{user?.email}</p>
            {user?.emailVerified && (
              <Badge variant="success" className="mt-2 gap-1 rounded-[2px] font-mono text-[11px] font-normal uppercase tracking-[0.06em]">
                <IconCheck className="h-3 w-3" strokeWidth={3} />
                Verified
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label="Edit email address"
            onClick={() => setModal('email')}
          >
            Edit
          </Button>
        </div>

        <div className="border-perf flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Password</p>
            <p className="text-sm text-muted-foreground">{passwordSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label="Edit password"
            onClick={() => setModal('password')}
          >
            Edit
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <label htmlFor="default-currency" className="min-w-0">
            <span className="block text-[15px] font-semibold">Default currency</span>
            <span className="block text-sm text-muted-foreground">Used for new subscriptions.</span>
          </label>
          <Select
            id="default-currency"
            className="h-10 w-full rounded-[2px] sm:w-[260px]"
            value={user?.defaultCurrency ?? DEFAULT_CURRENCY}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            disabled={savingCurrency}
          >
            {/* Named, not just coded: three of these share "kr" and six share
                "$", so the code alone stopped being enough to choose from. */}
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code} — {currencyName(code)}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {/* Mounted only while open so each open starts with fresh form state. */}
      {modal === 'name' && (
        <EditNameDialog open onOpenChange={(open) => setModal(open ? 'name' : null)} />
      )}
      {modal === 'email' && (
        <ChangeEmailDialog open onOpenChange={(open) => setModal(open ? 'email' : null)} />
      )}
      {modal === 'password' && (
        <ChangePasswordDialog open onOpenChange={(open) => setModal(open ? 'password' : null)} />
      )}
    </div>
  );
}
