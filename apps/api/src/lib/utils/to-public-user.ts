import { avatarContentTypeSchema } from '@noto/shared';
import type { User } from '@noto/shared';

type UserRecordForResponse = {
  id: string;
  email: string;
  username?: string | null;
  createdAt: Date;
  avatar?: {
    storageKey: string;
    contentType: string;
    size: number;
  } | null;
};

/** Публичный user DTO — без passwordHash, URL аватара не хранится в БД. */
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
    avatar: null,
  };
}

export async function toPublicUserWithAvatar(
  user: UserRecordForResponse,
  createReadUrl: (key: string) => Promise<string>,
): Promise<User> {
  const publicUser = toPublicUser(user);
  if (!user.avatar) {
    return publicUser;
  }

  return {
    ...publicUser,
    avatar: {
      url: await createReadUrl(user.avatar.storageKey),
      contentType: avatarContentTypeSchema.parse(user.avatar.contentType),
      size: user.avatar.size,
    },
  };
}
