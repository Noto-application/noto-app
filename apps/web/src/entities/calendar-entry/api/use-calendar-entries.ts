'use client';

import { calendarContract, calendarEntriesQuerySchema } from '@noto/shared';
import { skipToken, useQuery } from '@tanstack/react-query';

import { calendarEntryKeys, getCalendarEntries, getCalendarEntry } from './calendar-entries';

export function useCalendarEntry(projectId: string | undefined, pageId: string | undefined) {
  const params = calendarContract.get.pathParams.safeParse({ projectId, pageId });
  return useQuery({
    queryKey: calendarEntryKeys.page(projectId ?? '', pageId ?? ''),
    queryFn: params.success
      ? () => getCalendarEntry(params.data.projectId, params.data.pageId)
      : skipToken,
  });
}

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
