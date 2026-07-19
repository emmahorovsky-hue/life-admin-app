import type { User } from '../types/user';

/** Initials for the avatar tile: first letters of name + surname, falling back
 * to the email's first letter (design 1D identity block, LIF-181/LIF-200). */
export function getInitials(user: Pick<User, 'name' | 'surname' | 'email'> | null): string {
  if (!user) return '?';
  const fromNames = [user.name, user.surname]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('');
  return (fromNames || user.email.charAt(0)).toUpperCase();
}
