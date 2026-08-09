import cron from 'node-cron';
import { runUnverifiedAccountCleanup } from '../services/accountCleanupService';
import { deleteStaleTokens } from '../services/tokenCleanupService';
import { sendRenewalReminders } from '../services/renewalReminderService';
import { reportServerError } from '../utils/reportError';

// Daily at 03:00 UTC — warn unverified accounts nearing their deadline, then
// delete those already warned long enough ago.
const CLEANUP_SCHEDULE = process.env.CLEANUP_CRON ?? '0 3 * * *';

// Hourly — send renewal reminders for subscriptions due soon.
//
// Hourly rather than daily because delivery is per user in their own timezone
// (LIF-252): the job wakes every hour and each run notifies only the users for
// whom it is currently daytime, so nobody is woken at 2am by a server that
// happens to run on UTC. Most runs send nothing. Exactly-once is guaranteed by
// per-occurrence dedup in the service, not by the schedule, so running 24x more
// often does not send 24x more mail.
const RENEWAL_SCHEDULE = process.env.RENEWAL_CRON ?? '0 * * * *';

export function startCronJobs(): void {
  cron.schedule(
    CLEANUP_SCHEDULE,
    async () => {
      try {
        const { warned, deleted } = await runUnverifiedAccountCleanup();
        console.log(`[cron] unverified-account cleanup: warned=${warned} deleted=${deleted}`);
      } catch (err) {
        reportServerError('[cron] unverified-account cleanup failed', err);
      }

      // Separate try/catch on purpose: the two sweeps are independent, and a
      // failure in the account cleanup above must not skip the token sweep.
      try {
        const swept = await deleteStaleTokens();
        console.log(
          `[cron] stale-token sweep: verification=${swept.emailVerification} ` +
          `reset=${swept.passwordReset} emailChange=${swept.emailChange}`
        );
      } catch (err) {
        reportServerError('[cron] stale-token sweep failed', err);
      }
    },
    { timezone: 'UTC' }
  );

  cron.schedule(
    RENEWAL_SCHEDULE,
    async () => {
      try {
        const { email, push } = await sendRenewalReminders();
        // Quiet unless something was actually delivered or attempted. Now that
        // this fires hourly, logging every pass would bury the ~1 run a day
        // that sent something under 23 lines of zeros — and `skipped` is not
        // the line between them: a user stays due for the whole delivery
        // window, so every remaining in-window hour of their day reports the
        // same already-sent subscription as skipped. Only sent/failed mark a
        // run that did work.
        const delivered = [email, push].some((c) => c.sent + c.failed > 0);
        if (delivered) {
          console.log(
            `[cron] renewal-reminders: ` +
            `email(sent=${email.sent} skipped=${email.skipped} failed=${email.failed}) ` +
            `push(sent=${push.sent} skipped=${push.skipped} failed=${push.failed})`
          );
        }
      } catch (err) {
        reportServerError('[cron] renewal-reminders failed', err);
      }
    },
    { timezone: 'UTC' }
  );

  console.log(`[cron] scheduled unverified-account cleanup (${CLEANUP_SCHEDULE} UTC)`);
  console.log(`[cron] scheduled renewal-reminders (${RENEWAL_SCHEDULE} UTC)`);
}
