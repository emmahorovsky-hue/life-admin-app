import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { defaultBaseUrl, withDatabase, databaseName } from './testDb';

// Run once for the entire jest process — not per test file.
//
// Creates a database unique to this run and points DATABASE_URL at it; test
// workers are forked afterwards, so they inherit the env. globalTeardown
// (same process) drops the database again via the JEST_RUN_DB handoff.
export default async function globalSetup() {
  // JEST_BASE_DATABASE_URL is captured in jest.config.js before @prisma/client
  // (imported above) auto-loads server/.env — process.env.DATABASE_URL here may
  // already hold the DEV database URL, which must never be used as the base.
  const baseUrl = process.env.JEST_BASE_DATABASE_URL || defaultBaseUrl();
  const runDbName = `${databaseName(baseUrl)}_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;

  // CREATE DATABASE must be issued from a connection to a different database —
  // use the "postgres" maintenance DB on the same server.
  const admin = new PrismaClient({
    datasources: { db: { url: withDatabase(baseUrl, 'postgres') } },
  });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${runDbName}"`);
    process.env.DATABASE_URL = withDatabase(baseUrl, runDbName);
    process.env.JEST_RUN_DB = runDbName;
    console.log(`Created per-run test database "${runDbName}".`);
  } catch (error) {
    // No CREATEDB permission or no "postgres" maintenance DB: fall back to the
    // shared database (previous behavior) — unsafe if another run is active.
    console.warn(
      `Could not create per-run test database (${(error as Error).message.split('\n')[0]}). ` +
        `Falling back to shared "${databaseName(baseUrl)}" — do not run jest concurrently.`
    );
    process.env.DATABASE_URL = baseUrl;
  } finally {
    await admin.$disconnect();
  }

  console.log('Running Prisma migrations for test database...');
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('Migrations completed successfully.');
}
