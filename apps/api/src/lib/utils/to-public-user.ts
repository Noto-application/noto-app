import type { User } from '@noto/shared';

/** Публичный user DTO — без passwordHash, createdAt в ISO. */
export function toPublicUser(user: {
  id: string;
  email: string;
  username?: string | null;
  createdAt: Date;
}): User {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
