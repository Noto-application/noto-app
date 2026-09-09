'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Page } from '../model/types';
import { deletePage, pageKeys } from './pages';

export function useDeletePageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),

    onSuccess: (_, pageId) => {
      const page = queryClient.getQueryData<Page>(pageKeys.detail(pageId));

      queryClient.removeQueries({
        queryKey: pageKeys.detail(pageId),
      });

      if (page) {
        void queryClient.invalidateQueries({
          queryKey: pageKeys.list(page.projectId),
        });
      }
    },
  });
}
