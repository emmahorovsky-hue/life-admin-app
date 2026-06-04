import 'dotenv/config';
import prisma from '../utils/db';
import { runUnverifiedAccountCleanup } from '../services/accountCleanupService';

// Manual one-off runner for the unverified-account cleanup. Useful for ops and
// for a safe first production run before enabling the cron schedule.
//   npm run job:cleanup-unverified
async function main() {
  const { warned, deleted } = await runUnverifiedAccountCleanup();
  console.log(`Unverified-account cleanup complete: warned=${warned} deleted=${deleted}`);
}

main()
  .catch((err) => {
    console.error('Cleanup run failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
