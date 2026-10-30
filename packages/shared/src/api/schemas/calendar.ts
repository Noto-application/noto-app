import { z } from 'zod';

import { pageSchema, pageTitleSchema } from './page';

/** Максимум календарных дней в запрашиваемом диапазоне list (6-недельная сетка). */
export const CALENDAR_RANGE_MAX_DAYS = 42;

const DAY_MS = 86_400_000;

/**
 * Календарная дата — date-only `YYYY-MM-DD`, без времени и IANA timezone.
 * `z.iso.date()` отсеивает и кривой формат, и невозможные даты (`2026-02-30`).
 */
export const calendarDateSchema = z.iso.date();

/** Публичное представление календарной записи. `title`/`projectId` выводятся из
 * Page и не хранятся в записи (спека apps/api/src/calendar/calendar.spec.md). */
export const calendarEntrySchema = z.object({
  pageId: z.string(),
  projectId: z.string(),
  title: z.string(),
  date: calendarDateSchema,
  updatedAt: z.iso.datetime(),
});

export type CalendarEntry = z.infer<typeof calendarEntrySchema>;

/** Query list: полуинтервал `[from, to)`, `from < to`, не больше 42 дней. */
export const calendarEntriesQuerySchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
  })
  .refine(
    ({ from, to }) => Date.parse(`${from}T00:00:00.000Z`) < Date.parse(`${to}T00:00:00.000Z`),
    { message: 'from must be before to' },
  )
  .refine(
    ({ from, to }) =>
      (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS <=
      CALENDAR_RANGE_MAX_DAYS,
    { message: `range must not exceed ${CALENDAR_RANGE_MAX_DAYS} days` },
  );

/** Тело create. `projectId` — из пути. Ключ идемпотентности — `clientRequestId`. */
export const createCalendarPageSchema = z.object({
  title: pageTitleSchema,
  date: calendarDateSchema,
  clientRequestId: z.uuid(),
});

/** Тело PUT (desired-state CAS). `date: null` снимает дату, Page сохраняется. */
export const updateCalendarEntrySchema = z.object({
  date: calendarDateSchema.nullable(),
  expectedDate: calendarDateSchema.nullable(),
});

/** Ответ list. */
export const calendarEntriesResponseSchema = z.object({
  entries: z.array(calendarEntrySchema),
});

/** Ответ create/update; `entry: null` — дата снята. */
export const calendarEntryResponseSchema = z.object({
  entry: calendarEntrySchema.nullable(),
});

/** Ответ create: созданная/повторно отданная Page и текущая запись (или null). */
export const calendarPageResponseSchema = z.object({
  page: pageSchema,
  entry: calendarEntrySchema.nullable(),
});

/** Первый create всегда возвращает созданную запись; nullable — только replay. */
export const calendarCreatedPageResponseSchema = z.object({
  page: pageSchema,
  entry: calendarEntrySchema,
});
