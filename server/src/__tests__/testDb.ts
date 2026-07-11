// Helpers shared by jest globalSetup/globalTeardown for the per-run database.
// Each jest invocation gets its own database (base name + pid + random suffix)
// so concurrent runs can't clobber each other (LIF-167) — setup.ts wipes all
// tables between tests, which is destructive on a shared database.
import os from 'os';

export function defaultBaseUrl(): string {
  const user = os.userInfo().username;
  // Include an explicit empty password to ensure the URL contains a user.
  return `postgresql://${user}:@localhost:5432/lifeadmin_test?schema=public`;
}

export function withDatabase(url: string, dbName: string): string {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}
