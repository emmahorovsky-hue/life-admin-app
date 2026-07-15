import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AvatarTile } from '@/components/settings/AvatarTile';
import { EditNameDialog } from '@/components/settings/EditNameDialog';
import { ChangeEmailDialog } from '@/components/settings/ChangeEmailDialog';
import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';

type AccountModal = null | 'name' | 'email' | 'password';

export default function AccountPanel() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<AccountModal>(null);

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

  const displayName = [user?.name, user?.surname].filter(Boolean).join(' ') || user?.email;
  const passwordSubtitle = user?.passwordChangedAt
    ? `Last changed ${formatDistanceToNow(new Date(user.passwordChangedAt), { addSuffix: true })}.`
    : 'Never changed.';

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <section className="flex items-center gap-5 rounded-[2px] border border-border bg-white p-6 dark:bg-card">
        <AvatarTile size="lg" allowRemove />
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{displayName}</p>
          <p className="truncate font-mono text-[13px] text-muted-foreground">{user?.email}</p>
        </div>
      </section>

      {/* Details card */}
      <section className="rounded-[2px] border border-border bg-white px-6 dark:bg-card">
        <div className="border-perf flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Name</p>
            <p className="truncate text-sm text-muted-foreground">{displayName}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setModal('name')}>
            Edit
          </Button>
        </div>

        <div className="border-perf flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Email address</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{user?.email}</p>
            {user?.emailVerified && (
              <Badge variant="success" className="mt-2 gap-1 rounded-[2px] font-mono text-[11px] font-normal uppercase tracking-[0.06em]">
                <Check className="h-3 w-3" strokeWidth={3} />
                Verified
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setModal('email')}>
            Change
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Password</p>
            <p className="text-sm text-muted-foreground">{passwordSubtitle}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setModal('password')}>
            Change password
          </Button>
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
