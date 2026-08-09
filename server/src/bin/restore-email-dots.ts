import 'dotenv/config';
import prisma from '../utils/db';
import {
  restoreEmailDisplayForms,
  findInconsistentUsers,
} from '../services/emailDisplayBackfillService';

// One-off ops runner for accounts whose address was flattened before the
// display/identity split (LIF-80). normalizeEmail() destroyed the dots at write
// time, so the original spelling cannot be recovered from the database — you
// supply it, and the job only accepts it for the account its canonical form
// already identifies.
//
//   npm run job:restore-email-dots -- --verify
//   npm run job:restore-email-dots -- --dry-run first.last@gmail.com
//   npm run job:restore-email-dots -- first.last@gmail.com another.user@gmail.com
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const addresses = args.filter((a) => !a.startsWith('--'));

  if (verify) {
    const bad = await findInconsistentUsers();
    if (bad.length === 0) {
      console.log('All users consistent: every emailCanonical matches its email.');
    } else {
      console.error(`${bad.length} user(s) with a stale identity key:`);
      for (const u of bad) {
        console.error(`  ${u.id}  email=${u.email}  emailCanonical=${u.emailCanonical}  expected=${u.expected}`);
      }
      process.exitCode = 1;
    }
    if (addresses.length === 0) return;
  }

  if (addresses.length === 0) {
    console.error('Usage: npm run job:restore-email-dots -- [--dry-run] [--verify] <email> [email...]');
    process.exitCode = 1;
    return;
  }

  const { outcomes } = await restoreEmailDisplayForms(addresses, { dryRun });

  for (const outcome of outcomes) {
    if (outcome.status === 'applied') {
      console.log(`${dryRun ? '[dry-run] would update' : 'updated'} ${outcome.userId}: ${outcome.from} -> ${outcome.to}`);
    } else if (outcome.status === 'unchanged') {
      console.log(`unchanged ${outcome.userId}: ${outcome.email} is already the stored form`);
    } else {
      console.warn(`skipped ${outcome.input}: ${outcome.reason}`);
    }
  }

  const applied = outcomes.filter((o) => o.status === 'applied').length;
  const unchanged = outcomes.filter((o) => o.status === 'unchanged').length;
  const skipped = outcomes.filter((o) => o.status === 'skipped').length;
  console.log(
    `Email display restore complete${dryRun ? ' (dry run, nothing written)' : ''}: ` +
    `applied=${applied} unchanged=${unchanged} skipped=${skipped}`
  );

  if (skipped > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Email display restore failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
