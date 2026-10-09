import type { User } from '@life-admin/shared';

const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * Dashboard greeting: "Welcome" for an account created in the last day,
 * "Welcome back" after. The name is used only when one is set — the old
 * fallback to the email's local part greeted people as "tomasz.sssssss".
 */
export function greeting(
  user: Pick<User, 'name' | 'createdAt'> | null | undefined,
  now = Date.now(),
): string {
  const created = user?.createdAt ? new Date(user.createdAt).getTime() : NaN;
  const base = now - created < NEW_ACCOUNT_MS ? 'Welcome' : 'Welcome back';
  const name = user?.name?.trim();
  return name ? `${base}, ${name}` : base;
}
