import type { CalendarEntry } from '@noto/shared';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, apiClient } from '@/src/shared/api';

import { calendarEntryKeys, getCalendarEntries } from './calendar-entries';

type ListResponse = Awaited<ReturnType<typeof apiClient.calendar.list>>;
const projectId = '00000000-0000-4000-8000-000000000002';
const from = '2026-02-23';
const to = '2026-04-06';
const entry: CalendarEntry = {
  pageId: '00000000-0000-4000-8000-000000000001',
  projectId,
  title: 'Page title',
  date: '2026-03-29',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('calendarEntryKeys', () => {
  it('uses the project prefix and exact half-open range from the spec', () => {
    expect(calendarEntryKeys.project(projectId)).toEqual(['calendar-entry', projectId]);
    expect(calendarEntryKeys.range(projectId, from, to)).toEqual([
      'calendar-entry',
      projectId,
      'range',
      from,
      to,
    ]);
  });

  it('lets a project prefix invalidate all its ranges, not another project', async () => {
    const client = new QueryClient();
    const march = calendarEntryKeys.range(projectId, from, to);
    const april = calendarEntryKeys.range(projectId, '2026-03-30', '2026-05-04');
    const other = calendarEntryKeys.range('00000000-0000-4000-8000-000000000003', from, to);
    try {
      for (const key of [march, april, other]) client.setQueryData(key, []);
      await client.invalidateQueries({ queryKey: calendarEntryKeys.project(projectId) });
      expect(client.getQueryState(march)?.isInvalidated).toBe(true);
      expect(client.getQueryState(april)?.isInvalidated).toBe(true);
      expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    } finally {
      client.clear();
    }
  });
});

describe('getCalendarEntries', () => {
  it.each([{ entries: [entry] }, { entries: [] }])(
    'returns domain DTOs unchanged: $entries',
    async ({ entries }) => {
      const list = vi.spyOn(apiClient.calendar, 'list').mockResolvedValue({
        status: 200,
        body: { entries },
        headers: new Headers(),
      } satisfies ListResponse);
      await expect(getCalendarEntries(projectId, from, to)).resolves.toEqual(entries);
      expect(list).toHaveBeenCalledWith({ params: { projectId }, query: { from, to } });
    },
  );

  it.each([
    [400, 'VALIDATION_ERROR'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ] as const)('preserves API error %s (%s), not an empty success', async (status, code) => {
    vi.spyOn(apiClient.calendar, 'list').mockResolvedValue({
      status,
      body: { code, message: 'Calendar request failed', details: { source: 'calendar' } },
      headers: new Headers(),
    } satisfies ListResponse);
    const request = getCalendarEntries(projectId, from, to);
    await expect(request).rejects.toBeInstanceOf(ApiClientError);
    await expect(request).rejects.toMatchObject({
      code,
      message: 'Calendar request failed',
      details: { source: 'calendar' },
    });
  });

  it('propagates transport errors', async () => {
    const error = new TypeError('Network error');
    vi.spyOn(apiClient.calendar, 'list').mockRejectedValue(error);
    await expect(getCalendarEntries(projectId, from, to)).rejects.toBe(error);
  });
});
