'use client';

import type { User } from '@noto/shared/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser, userKeys } from '@/src/entities/user';
import { ApiClientError, apiClient, toApiClientError } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';

/**
 * Сохраняет отображаемое имя текущего пользователя (issue #125). `userId`
 * берётся из своей сессии (`useCurrentUser`), не принимается параметром —
 * хук всегда работает со своим профилем.
 */
export function useUpdateUsername() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation<User, Error, string>({
    mutationFn: async (username) => {
      if (!currentUser) {
        throw new Error('Current user is not available');
      }

      const response = await apiClient.users.update({
        params: { userId: currentUser.id },
        body: { username },
      });

      if (response.status !== 200) {
        throw toApiClientError(response.body);
      }

      return response.body.user;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userKeys.current() });
      toast.success('Имя сохранено');
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {
        return;
      }

      toast.error('Не удалось сохранить имя', 'Проверьте соединение и повторите попытку.');
    },
  });
}
