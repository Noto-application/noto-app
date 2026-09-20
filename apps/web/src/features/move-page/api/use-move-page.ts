'use client';

import type { UpdatePageInput } from '@noto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { pageKeys, updatePage } from '@/src/entities/page';

export type MovePageInput = Pick<UpdatePageInput, 'parentId' | 'position'> & {
  pageId: string;
  projectId: string;
};

/** Перемещает страницу и обновляет дерево текущего проекта. */
export function useMovePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, parentId, position }: MovePageInput) =>
      updatePage(pageId, { parentId, position }),
    onSuccess: (_, { projectId }) =>
      queryClient.invalidateQueries({
        queryKey: pageKeys.list(projectId),
      }),
  });
}
