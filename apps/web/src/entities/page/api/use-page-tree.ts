'use client';

import { useQuery } from '@tanstack/react-query';

import { buildPageTree } from '../lib/build-page-tree';

import { getPagesList, pageKeys } from './pages';

export function usePageTree(projectId: string) {
  return useQuery({
    queryKey: pageKeys.list(projectId),
    queryFn: () => getPagesList(projectId),
    select: buildPageTree,
  });
}
