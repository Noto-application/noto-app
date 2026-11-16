'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Page } from '../model/types';
import { deletePage, pageKeys } from './pages';
import { trashKeys } from './trash';

export function useDeletePageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),

    onSuccess: (_, pageId) => {
      const page =
        queryClient.getQueryData<Page | null>(pageKeys.detail(pageId)) ??
        queryClient
          .getQueriesData<Page[]>({ queryKey: ['pages', 'list'] })
          .flatMap(([, pages]) => pages ?? [])
          .find((item) => item.id === pageId);

      queryClient.removeQueries({
        queryKey: pageKeys.detail(pageId),
      });

      if (page) {
        void queryClient.invalidateQueries({
          queryKey: pageKeys.list(page.projectId),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['pages', 'list'] });
      }
      void queryClient.invalidateQueries({
        queryKey: page ? trashKeys.list(page.projectId) : ['pages', 'trash'],
      });
    },
  });
}
