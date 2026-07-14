import type { User } from '@life-admin/shared';

export function getInitials(user: Pick<User, 'name' | 'surname' | 'email'> | null): string {
  if (!user) return '?';
  const fromNames = [user.name, user.surname]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('');
  return (fromNames || user.email.charAt(0)).toUpperCase();
}
