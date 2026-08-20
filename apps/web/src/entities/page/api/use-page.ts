'use client';

import { useQuery } from '@tanstack/react-query';

import { getPage, pageKeys } from './pages';

export function usePage(id: string) {
  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: async () => (await getPage(id)) ?? null,
  });
}
