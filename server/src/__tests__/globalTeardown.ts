import { PrismaClient } from '@prisma/client';
import { withDatabase } from './testDb';

// Drops the per-run database created by globalSetup. Runs in the same process,
// so the JEST_RUN_DB handoff env var set there is visible here. If globalSetup
// fell back to the shared database, JEST_RUN_DB is unset and there is nothing
// to drop.
export default async function globalTeardown() {
  const runDbName = process.env.JEST_RUN_DB;
  if (!runDbName || !process.env.DATABASE_URL) return;

  const admin = new PrismaClient({
    datasources: { db: { url: withDatabase(process.env.DATABASE_URL, 'postgres') } },
  });
  try {
    // FORCE (Postgres 13+) terminates any connection a worker left behind.
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${runDbName}" WITH (FORCE)`);
  } catch (error) {
    console.warn(
      `Could not drop per-run test database "${runDbName}": ${(error as Error).message.split('\n')[0]}. ` +
        'Drop it manually if it lingers.'
    );
  } finally {
    await admin.$disconnect();
  }
}
