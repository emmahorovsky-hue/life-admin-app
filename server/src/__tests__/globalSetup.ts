import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

// Run once for the entire jest process — not per test file.
export default async function globalSetup() {
  // Ensure DATABASE_URL is set so Prisma can connect.
  if (!process.env.DATABASE_URL) {
    const user = os.userInfo().username;
    process.env.DATABASE_URL = `postgresql://${user}:@localhost:5432/lifeadmin_test?schema=public`;
  }

  try {
    console.log('Running Prisma migrations for test database...');
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.warn('Migration warning (tables may already exist):', (error as Error).message);
    // Continue — tables might already exist from a previous run.
  }
}
