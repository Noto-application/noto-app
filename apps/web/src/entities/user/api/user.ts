import type { AuthUserResponse } from '@noto/shared/api';

import { apiClient, toApiClientError } from '@/src/shared/api';

export const userKeys = {
  current: () => ['user', 'current'] as const,
};

/** Возвращает текущего пользователя из cookie-сессии. */
export async function getCurrentUser(): Promise<AuthUserResponse['user']> {
  const response = await apiClient.auth.me();

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.user;
}
