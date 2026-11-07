import {
  calendarCreatedPageResponseSchema,
  calendarPageResponseSchema,
  calendarEntryResponseSchema,
  type CreateCalendarPageInput,
  type UpdateCalendarEntryInput,
} from '@noto/shared';

import { apiClient, toApiClientError } from '@/src/shared/api';

/** Статус сохраняется до error-проекции: даже невалидный 2xx мог быть закоммичен. */
export class CalendarMutationError extends Error {
  constructor(
    readonly status: number,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : 'Не удалось выполнить запрос', { cause });
    this.name = 'CalendarMutationError';
  }
}

export async function createCalendarPage(projectId: string, input: CreateCalendarPageInput) {
  const response = await apiClient.calendar.create({ params: { projectId }, body: input });
  if (response.status !== 201 && response.status !== 200) {
    throw new CalendarMutationError(response.status, toApiClientError(response.body));
  }
  const parsed = (
    response.status === 201 ? calendarCreatedPageResponseSchema : calendarPageResponseSchema
  ).safeParse(response.body);
  if (!parsed.success) throw new CalendarMutationError(response.status, parsed.error);
  return parsed.data;
}

export async function updateCalendarEntry(
  projectId: string,
  pageId: string,
  input: UpdateCalendarEntryInput,
) {
  const response = await apiClient.calendar.update({ params: { projectId, pageId }, body: input });
  if (response.status !== 200) {
    throw new CalendarMutationError(response.status, toApiClientError(response.body));
  }
  const parsed = calendarEntryResponseSchema.safeParse(response.body);
  if (!parsed.success) throw new CalendarMutationError(response.status, parsed.error);
  return parsed.data.entry;
}
