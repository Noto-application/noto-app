'use client';

import {
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';

import { pageKeys, restorePage, trashKeys } from '@/src/entities/page';
import { ApiClientError } from '@/src/shared/api';

export function useRestorePage(projectId: string, pageId: string) {
  const client = useQueryClient();
  const mutationKey = ['pages', 'restore', projectId, pageId] as const;
  const pendingCount = useIsMutating({ mutationKey, exact: true });
  const errors = useMutationState({
    filters: { mutationKey, exact: true },
    select: (operation) => operation.state.error,
  });

  const refresh = async (variables: { projectId: string; pageId: string }) => {
    // Ошибка повторного GET не отменяет успешный POST; её покажет query.
    await Promise.allSettled([
      client.invalidateQueries({ queryKey: trashKeys.list(variables.projectId) }),
      client.invalidateQueries({ queryKey: pageKeys.list(variables.projectId) }),
      client.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) }),
    ]);
  };

  const mutation = useMutation({
    mutationKey,
    mutationFn: (variables: { projectId: string; pageId: string }) => restorePage(variables.pageId),
    retry: false,
    onSuccess: (_, variables) => refresh(variables),
    onError: (error, variables) => {
      if (error instanceof ApiClientError && error.code === 'NOT_FOUND') return refresh(variables);
    },
  });

  const restore = async () => {
    // Mutation cache переживает размонтирование строки; проверка синхронная,
    // поэтому блокирует и два вызова до следующего render.
    if (client.isMutating({ mutationKey, exact: true }) > 0) return undefined;
    return mutation.mutateAsync({ projectId, pageId });
  };

  // Последняя попытка сбрасывает прежнюю ошибку при старте и сохраняет новую
  // для строки, повторно открытой после навигации.
  return { restore, isPending: pendingCount > 0, error: errors.at(-1) ?? null };
}
