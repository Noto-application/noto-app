import type { CalendarEntry, CalendarPageResponse, Page } from '@noto/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { createCalendarPage, updateCalendarEntry } from './calendar-mutations';

// Предлагаемые публичные обёртки одного feature-среза; production-кода пока нет.
const projectId = '00000000-0000-4000-8000-000000000002';
const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId,
  parentId: null,
  title: 'Scheduled',
  content: [],
  position: 0,
  currentUserRole: 'editor',
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
};
const entry: CalendarEntry = {
  pageId: page.id,
  projectId,
  title: page.title,
  date: '2026-11-01',
  updatedAt: page.updatedAt,
};
const input = {
  title: page.title,
  date: entry.date,
  clientRequestId: '00000000-0000-4000-8000-000000000003',
};
const reply = <S extends number, B>(status: S, body: B) => ({
  status,
  body,
  headers: new Headers(),
});

afterEach(() => vi.restoreAllMocks());

describe('calendar mutation adapters (#136)', () => {
  it.each([
    [201, { page, entry }],
    [200, { page, entry }],
    [200, { page, entry: null }],
  ] satisfies Array<[number, CalendarPageResponse]>)(
    'accepts verified create/replay %s: %j',
    async (status, body) => {
      const create = vi
        .spyOn(apiClient.calendar, 'create')
        .mockResolvedValue(reply(status, body) as never);
      await expect(createCalendarPage(projectId, input)).resolves.toEqual(body);
      expect(create).toHaveBeenCalledWith({ params: { projectId }, body: input });
    },
  );

  it.each([
    [400, { code: 'VALIDATION_ERROR', message: 'Invalid' }],
    [401, { code: 'UNAUTHORIZED', message: 'Sign in' }],
    [403, { code: 'FORBIDDEN', message: 'No access' }],
    [404, { code: 'NOT_FOUND', message: 'Gone' }],
    [409, { code: 'CONFLICT', message: 'Fingerprint mismatch' }],
    [500, { unexpected: 'upstream failure' }],
  ])('retains raw HTTP status %s even when error projection loses it', async (status, body) => {
    vi.spyOn(apiClient.calendar, 'create').mockResolvedValue(reply(status, body) as never);
    await expect(createCalendarPage(projectId, input)).rejects.toMatchObject({ status });
  });

  it.each([
    [201, { page, entry: null }],
    [200, { page: { id: page.id }, entry }],
  ])('rejects malformed success %s, not a resolved create', async (status, body) => {
    vi.spyOn(apiClient.calendar, 'create').mockResolvedValue(reply(status, body) as never);
    await expect(createCalendarPage(projectId, input)).rejects.toMatchObject({ status });
  });

  it('does not disguise a transport failure as a known HTTP rejection', async () => {
    vi.spyOn(apiClient.calendar, 'create').mockRejectedValue(new TypeError('Network error'));
    await expect(createCalendarPage(projectId, input)).rejects.not.toHaveProperty('status');
  });

  it.each([entry, null])(
    'returns the PUT desired state without a Page mutation: %s',
    async (value) => {
      const body = { date: value?.date ?? null, expectedDate: '2026-10-31' };
      const update = vi
        .spyOn(apiClient.calendar, 'update')
        .mockResolvedValue(reply(200, { entry: value }));
      const patch = vi.spyOn(apiClient.pages, 'update');
      await expect(updateCalendarEntry(projectId, page.id, body)).resolves.toEqual(value);
      expect(update).toHaveBeenCalledWith({ params: { projectId, pageId: page.id }, body });
      expect(patch).not.toHaveBeenCalled();
    },
  );
});
