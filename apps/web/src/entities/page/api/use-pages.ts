'use client';

import { useQuery } from '@tanstack/react-query';

import { getPagesByProject, pageKeys } from './pages';

export function usePages(projectId: string) {
  return useQuery({
    queryKey: pageKeys.byProject(projectId),
    queryFn: () => getPagesByProject(projectId),
  });
}
