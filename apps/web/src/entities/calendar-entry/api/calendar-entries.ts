import type { CalendarEntry } from '@noto/shared';

import { apiClient, toApiClientError } from '@/src/shared/api';

export const calendarEntryKeys = {
  project: (projectId: string) => ['calendar-entry', projectId] as const,
  range: (projectId: string, from: string, to: string) =>
    [...calendarEntryKeys.project(projectId), 'range', from, to] as const,
};

export async function getCalendarEntries(
  projectId: string,
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  const response = await apiClient.calendar.list({ params: { projectId }, query: { from, to } });
  if (response.status !== 200) throw toApiClientError(response.body);
  return response.body.entries;
}
