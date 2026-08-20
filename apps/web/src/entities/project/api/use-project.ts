'use client';

import { useQuery } from '@tanstack/react-query';

import { getProject, projectKeys } from './projects';

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => (await getProject(id)) ?? null,
  });
}
