import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { updateProfile } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';

/**
 * Notifications panel (LIF-185). One control by design: the global renewal
 * reminders toggle. Timing is cycle-aware on the server (weekly 1d … annual
 * 14d — see docs/design/renewal-reminders-strategy.md), so there is no
 * user-set "remind me N days" here; per-subscription mutes live in the
 * subscription edit dialog.
 */
export default function NotificationsPanel() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);

  // The switch reflects server state and only moves once the save succeeds,
  // so a failed request needs no rollback.
  const enabled = user?.reminderEmailsEnabled ?? true;

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await updateProfile({ reminderEmailsEnabled: next });
      updateUser(res.data.user);
      toast.success(next ? 'Renewal reminders turned on.' : 'Renewal reminders turned off.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update reminder settings. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[2px] border border-border bg-white px-6 py-2 dark:bg-card">
      <div className="leader-dots flex items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <label htmlFor="renewal-reminders" className="text-base font-bold">
            Renewal reminders
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A heads-up before a subscription renews.
          </p>
        </div>
        <Switch
          id="renewal-reminders"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>
      <p className="py-4 text-sm text-muted-foreground">
        Timing adjusts to each billing cycle — from a day before weekly renewals to two weeks
        before annual ones. You can also mute individual subscriptions when editing them.
      </p>
    </section>
  );
}
