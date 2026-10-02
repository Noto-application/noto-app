import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import {
  calendarEntriesQuerySchema,
  calendarEntriesResponseSchema,
  calendarEntryResponseSchema,
  calendarPageResponseSchema,
  calendarCreatedPageResponseSchema,
  createCalendarPageSchema,
  updateCalendarEntrySchema,
} from '../schemas/calendar';

const c = initContract();

const projectIdParamSchema = z.object({ projectId: z.uuid() });
const calendarEntryParamSchema = z.object({ projectId: z.uuid(), pageId: z.uuid() });

/**
 * Календарь страниц (спека apps/api/src/calendar/calendar.spec.md). Дата —
 * date-only, отдельная 1:1 запись к Page. `409` несёт две независимые
 * семантики: несовпадение fingerprint по ключу идемпотентности create и
 * CAS mismatch PUT.
 */
export const calendarContract = c.router({
  list: {
    method: 'GET',
    path: '/projects/:projectId/calendar-entries',
    pathParams: projectIdParamSchema,
    query: calendarEntriesQuerySchema,
    responses: {
      200: calendarEntriesResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'List dated pages of a project in [from, to) (viewer+)',
  },
  create: {
    method: 'POST',
    path: '/projects/:projectId/calendar-pages',
    pathParams: projectIdParamSchema,
    body: createCalendarPageSchema,
    responses: {
      201: calendarCreatedPageResponseSchema,
      // Replay того же ключа идемпотентности — текущее состояние, без создания.
      200: calendarPageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
      409: apiErrorSchema,
    },
    summary: 'Create a root page scheduled for a date (editor+)',
  },
  update: {
    method: 'PUT',
    path: '/projects/:projectId/calendar-entries/:pageId',
    pathParams: calendarEntryParamSchema,
    body: updateCalendarEntrySchema,
    responses: {
      200: calendarEntryResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
      409: apiErrorSchema,
    },
    summary: 'Set, move or clear a page calendar date (editor+)',
  },
});
