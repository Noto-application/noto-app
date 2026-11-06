'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { getTrashPages, trashKeys } from './trash';

export function useTrashPages(projectId: string) {
  return useInfiniteQuery({
    queryKey: trashKeys.list(projectId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getTrashPages(projectId, { limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}
