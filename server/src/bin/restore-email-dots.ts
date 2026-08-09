import 'dotenv/config';
import prisma from '../utils/db';
import {
  restoreEmailDisplayForms,
  findInconsistentUsers,
  repairCanonicalKeys,
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
//
// --repair is a different job that happens to live in the same runner, and it
// writes the other column:
//
//   npm run job:restore-email-dots -- --repair --dry-run
//   npm run job:restore-email-dots -- --repair
//
// The two modes are mutually exclusive on purpose. --verify prints the stale
// `emailCanonical` of every broken row, and pasting one of those addresses back
// in as an argument is the natural next move — it is also the one thing that
// must not happen, because the dots mode would match that row and overwrite the
// user's *new* address with the old one. Rejecting the combination outright is
// the only way an operator finds that out before the write rather than after.
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const repair = args.includes('--repair');
  const addresses = args.filter((a) => !a.startsWith('--'));

  if (repair && addresses.length > 0) {
    console.error(
      '--repair takes no addresses: it derives every value it writes from the ' +
      'accounts themselves. Passing the addresses --verify printed would run the ' +
      'display-restore mode instead and revert those users to their old email.'
    );
    process.exitCode = 1;
    return;
  }

  if (verify) {
    const bad = await findInconsistentUsers();
    if (bad.length === 0) {
      console.log('All users consistent: every emailCanonical matches its email.');
    } else {
      console.error(`${bad.length} user(s) with a stale identity key:`);
      for (const u of bad) {
        console.error(`  ${u.id}  email=${u.email}  emailCanonical=${u.emailCanonical}  expected=${u.expected}`);
      }
      console.error('Fix with: npm run job:restore-email-dots -- --repair --dry-run');
      process.exitCode = 1;
    }
    if (!repair && addresses.length === 0) return;
  }

  if (repair) {
    const { outcomes } = await repairCanonicalKeys({ dryRun });

    for (const outcome of outcomes) {
      if (outcome.status === 'repaired') {
        console.log(
          `${dryRun ? '[dry-run] would repoint' : 'repointed'} ${outcome.userId} (${outcome.email}): ` +
          `emailCanonical ${outcome.from} -> ${outcome.to}`
        );
      } else if (outcome.status === 'blocked') {
        console.error(
          `blocked ${outcome.userId} (${outcome.email}): ${outcome.to} is already held by ${outcome.heldBy}. ` +
          'Two accounts claim one inbox — merge them by hand, then re-run.'
        );
      } else {
        console.error(`skipped ${outcome.userId} (${outcome.email}): ${outcome.reason}`);
      }
    }

    const repaired = outcomes.filter((o) => o.status === 'repaired').length;
    const unresolved = outcomes.length - repaired;
    console.log(
      `Identity key repair complete${dryRun ? ' (dry run, nothing written)' : ''}: ` +
      `repaired=${repaired} needs-attention=${unresolved}`
    );

    // Rows still broken at exit — a dry run fixed none of them. Assigned rather
    // than only ever raised, so a real repair can clear the code --verify set
    // for the very rows it just fixed.
    const stillBroken = unresolved + (dryRun ? repaired : 0);
    process.exitCode = stillBroken > 0 ? 1 : 0;
    return;
  }

  if (addresses.length === 0) {
    console.error(
      'Usage: npm run job:restore-email-dots -- [--dry-run] [--verify] <email> [email...]\n' +
      '       npm run job:restore-email-dots -- --repair [--dry-run]'
    );
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
