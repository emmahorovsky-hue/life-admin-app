import { Prisma } from '@prisma/client';

// Single source of truth for the public user payload every auth path returns
// (register / login / getMe / updateProfile) plus the account endpoints.
// Mirrors the shared `User` type in packages/shared/src/types/user.ts — extend
// both together, and add the new field to toPublicUser below (LIF-132).
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  surname: true,
  emailVerified: true,
  emailVerifiedAt: true,
  passwordChangedAt: true,
  reminderEmailsEnabled: true,
  reminderPushEnabled: true,
  timezone: true,
  theme: true,
  defaultCurrency: true,
  createdAt: true,
  updatedAt: true,
  // Avatar bytes live in their own table so they never ride along on user
  // reads; the payload only carries the timestamp (null = no avatar), which
  // the client uses both as an "has avatar" flag and a cache-buster.
  avatar: { select: { updatedAt: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

export type PublicUser = Omit<SelectedUser, 'avatar'> & { avatarUpdatedAt: Date | null };

// Flattens the avatar relation into avatarUpdatedAt. Picks fields explicitly —
// never spread here: login passes a full row (it needs the password hash to
// compare), and a spread would leak it into the response.
export function toPublicUser(user: SelectedUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    passwordChangedAt: user.passwordChangedAt,
    reminderEmailsEnabled: user.reminderEmailsEnabled,
    reminderPushEnabled: user.reminderPushEnabled,
    timezone: user.timezone,
    theme: user.theme,
    defaultCurrency: user.defaultCurrency,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    avatarUpdatedAt: user.avatar?.updatedAt ?? null,
  };
}
