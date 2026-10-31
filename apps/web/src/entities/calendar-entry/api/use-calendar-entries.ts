'use client';

import { calendarContract, calendarEntriesQuerySchema } from '@noto/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { calendarEntryKeys, getCalendarEntries } from './calendar-entries';

export function useCalendarEntries(
  projectId: string | undefined,
  from: string | undefined,
  to: string | undefined,
) {
  const params = calendarContract.list.pathParams.safeParse({ projectId });
  const range = calendarEntriesQuerySchema.safeParse({ from, to });

  return useQuery({
    queryKey: calendarEntryKeys.range(projectId ?? '', from ?? '', to ?? ''),
    queryFn:
      params.success && range.success
        ? () => getCalendarEntries(params.data.projectId, range.data.from, range.data.to)
        : skipToken,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
