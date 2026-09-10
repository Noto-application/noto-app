'use client';

import { useQuery } from '@tanstack/react-query';

import { getPage, pageKeys } from './pages';

export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: pageKeys.detail(id ?? ''),
    queryFn: async () => (await getPage(id!)) ?? null,
    enabled: Boolean(id),
  });
}
