'use client';

import { useQuery } from '@tanstack/react-query';

import { getProjects, projectKeys } from './projects';

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all(),
    queryFn: getProjects,
  });
}
