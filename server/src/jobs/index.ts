import cron from 'node-cron';
import { runUnverifiedAccountCleanup } from '../services/accountCleanupService';
import { reportServerError } from '../utils/reportError';

// Daily at 03:00 UTC — warn unverified accounts nearing their deadline, then
// delete those already warned long enough ago.
const CLEANUP_SCHEDULE = process.env.CLEANUP_CRON ?? '0 3 * * *';

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
    },
    { timezone: 'UTC' }
  );

  console.log(`[cron] scheduled unverified-account cleanup (${CLEANUP_SCHEDULE} UTC)`);
}
