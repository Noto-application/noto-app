'use client';

import { useQuery } from '@tanstack/react-query';

import { getPagesList, pageKeys } from './pages';

export function usePagesList(projectId: string) {
  return useQuery({
    queryKey: pageKeys.list(projectId),
    queryFn: () => getPagesList(projectId),
  });
}
