'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deletePage, pageKeys } from './pages';

export function useDeletePageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),

    onSuccess: (_, pageId) => {
      queryClient.removeQueries({
        queryKey: pageKeys.detail(pageId),
      });

      queryClient.invalidateQueries({
        queryKey: ['pages', 'list'],
      });
    },
  });
}
