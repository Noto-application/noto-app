'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser, userKeys } from './user';

/** Server state пользователя: используется приватной частью приложения. */
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.current(),
    queryFn: getCurrentUser,
  });
}
