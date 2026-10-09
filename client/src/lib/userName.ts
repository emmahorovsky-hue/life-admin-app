import type { User } from '@life-admin/shared';

/**
 * "First Last" when the user has set a name, otherwise null — never the email.
 * Falling back to the email made Account show the address four times over for
 * anyone who never set a name; callers decide what an empty name looks like.
 */
export function fullName(user: Pick<User, 'name' | 'surname'> | null | undefined): string | null {
  return [user?.name?.trim(), user?.surname?.trim()].filter(Boolean).join(' ') || null;
}
