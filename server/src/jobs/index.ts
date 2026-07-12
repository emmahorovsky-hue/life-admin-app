import cron from 'node-cron';
import { runUnverifiedAccountCleanup } from '../services/accountCleanupService';
import { sendRenewalReminders } from '../services/renewalReminderService';
import { reportServerError } from '../utils/reportError';

// Daily at 03:00 UTC — warn unverified accounts nearing their deadline, then
// delete those already warned long enough ago.
const CLEANUP_SCHEDULE = process.env.CLEANUP_CRON ?? '0 3 * * *';

// Daily at 09:00 UTC — send renewal reminder emails for subscriptions due soon.
const RENEWAL_SCHEDULE = process.env.RENEWAL_CRON ?? '0 9 * * *';

export function startCronJobs(): void {
  cron.schedule(
    CLEANUP_SCHEDULE,
    async () => {
      try {
        const { warned, deleted } = await runUnverifiedAccountCleanup();
        console.log(`[cron] unverified-account cleanup: warned=${warned} deleted=${deleted}`);
      } catch (err) {
        console.error('[cron] unverified-account cleanup failed:', err);
      }
    },
    { timezone: 'UTC' }
  );

  cron.schedule(
    RENEWAL_SCHEDULE,
    async () => {
      try {
        const { sent, skipped, failed } = await sendRenewalReminders();
        console.log(`[cron] renewal-reminders: sent=${sent} skipped=${skipped} failed=${failed}`);
      } catch (err) {
        reportServerError('[cron] renewal-reminders failed', err);
      }
    },
    { timezone: 'UTC' }
  );

  console.log(`[cron] scheduled unverified-account cleanup (${CLEANUP_SCHEDULE} UTC)`);
  console.log(`[cron] scheduled renewal-reminders (${RENEWAL_SCHEDULE} UTC)`);
}
