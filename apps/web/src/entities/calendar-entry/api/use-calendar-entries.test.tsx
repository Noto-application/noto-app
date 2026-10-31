// @vitest-environment jsdom
import type { CalendarEntry } from '@noto/shared';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { calendarEntryKeys } from './calendar-entries';
import { useCalendarEntries } from './use-calendar-entries';

type ListResponse = Awaited<ReturnType<typeof apiClient.calendar.list>>;
const projectId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const from = '2026-02-23';
const to = '2026-04-06';
const entry: CalendarEntry = {
  pageId: '00000000-0000-4000-8000-000000000001',
  projectId,
  title: 'Original title',
  date: '2026-03-29',
  updatedAt: '2026-03-01T00:00:00.000Z',
};
const response = (entries: CalendarEntry[]): ListResponse => ({
  status: 200,
  body: { entries },
  headers: new Headers(),
});
const clients: QueryClient[] = [];

function setup() {
  // Как у QueryProvider: календарь обязан переопределить отключённый focus refetch.
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function visibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(state === 'hidden');
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  visibility('visible');
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('useCalendarEntries', () => {
  it('loads and shares data under the exact range key', async () => {
    vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(response([entry]));
    const { client, wrapper } = setup();
    const first = renderHook(() => useCalendarEntries(projectId, from, to), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual([entry]));
    const second = renderHook(
      () => {
        const query = useCalendarEntries(projectId, from, to);
        return { data: query.data, isFetching: query.isFetching };
      },
      { wrapper },
    );
    await waitFor(() => expect(second.result.current.data).toEqual([entry]));
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
    expect(client.getQueryData(calendarEntryKeys.range(projectId, from, to))).toEqual([entry]);
    act(() => {
      client.setQueryData(calendarEntryKeys.range(projectId, from, to), []);
    });
    await waitFor(() => {
      expect(first.result.current.data).toEqual([]);
      expect(second.result.current.data).toEqual([]);
    });
  });

  it.each([
    [undefined, from, to],
    [projectId, undefined, to],
    [projectId, from, undefined],
  ])('does not request an unresolved context (%s, %s, %s)', async (project, start, end) => {
    const list = vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(response([]));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCalendarEntries(project, start, end), { wrapper });
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(list).not.toHaveBeenCalled();
  });

  it('isolates project and range caches and uses each new context', async () => {
    const list = vi
      .spyOn(apiClient.calendar, 'list')
      .mockImplementation(({ params, query }) =>
        Promise.resolve(
          response([
            { ...entry, projectId: params.projectId, title: `${params.projectId}:${query.from}` },
          ]),
        ),
      );
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ project, start, end }) => useCalendarEntries(project, start, end),
      { wrapper, initialProps: { project: projectId, start: from, end: to } },
    );
    await waitFor(() => expect(result.current.data?.[0].title).toBe(`${projectId}:${from}`));
    rerender({ project: otherId, start: from, end: to });
    await waitFor(() => expect(result.current.data?.[0].title).toBe(`${otherId}:${from}`));
    rerender({ project: otherId, start: '2026-03-30', end: '2026-05-04' });
    await waitFor(() => expect(result.current.data?.[0].title).toBe(`${otherId}:2026-03-30`));
    expect(list).toHaveBeenCalledWith({
      params: { projectId: otherId },
      query: { from: '2026-03-30', to: '2026-05-04' },
    });
    expect(client.getQueryData(calendarEntryKeys.range(projectId, from, to))).toEqual([
      { ...entry, title: `${projectId}:${from}` },
    ]);
    expect(client.getQueryData(calendarEntryKeys.range(otherId, from, to))).toEqual([
      { ...entry, projectId: otherId, title: `${otherId}:${from}` },
    ]);
  });

  it('does not let a late previous-project response replace the current project', async () => {
    let resolveOld!: (value: ListResponse) => void;
    const oldResponse = new Promise<ListResponse>((resolve) => {
      resolveOld = resolve;
    });
    const list = vi
      .spyOn(apiClient.calendar, 'list')
      .mockImplementation(({ params }) =>
        params.projectId === projectId
          ? oldResponse
          : Promise.resolve(response([{ ...entry, projectId: otherId, title: 'Current' }])),
      );
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook((project) => useCalendarEntries(project, from, to), {
      wrapper,
      initialProps: projectId,
    });
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ params: { projectId }, query: { from, to } }),
    );
    rerender(otherId);
    await waitFor(() => expect(result.current.data?.[0].title).toBe('Current'));
    await act(async () => {
      resolveOld(response([entry]));
      await waitFor(() => {
        expect(client.getQueryData(calendarEntryKeys.range(projectId, from, to))).toEqual([entry]);
        expect(
          client.getQueryState(calendarEntryKeys.range(projectId, from, to))?.fetchStatus,
        ).toBe('idle');
      });
    });
    expect(result.current.data).toEqual([{ ...entry, projectId: otherId, title: 'Current' }]);
  });

  it('does not expose previous-project entries while the new project is pending', async () => {
    let resolveNext!: (value: ListResponse) => void;
    const nextResponse = new Promise<ListResponse>((resolve) => {
      resolveNext = resolve;
    });
    const currentEntry = { ...entry, projectId: otherId, title: 'New project Page' };
    const list = vi
      .spyOn(apiClient.calendar, 'list')
      .mockImplementation(({ params }) =>
        params.projectId === projectId ? Promise.resolve(response([entry])) : nextResponse,
      );
    const { wrapper } = setup();
    const { result, rerender } = renderHook((project) => useCalendarEntries(project, from, to), {
      wrapper,
      initialProps: projectId,
    });
    await waitFor(() => expect(result.current.data).toEqual([entry]));
    rerender(otherId);
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith({ params: { projectId: otherId }, query: { from, to } }),
    );
    expect(result.current.fetchStatus).toBe('fetching');
    expect(
      result.current.data?.some((item: CalendarEntry) => item.projectId !== otherId) ?? false,
    ).toBe(false);
    await act(async () => {
      resolveNext(response([currentEntry]));
      await nextResponse;
    });
    await waitFor(() => expect(result.current.data).toEqual([currentEntry]));
  });

  it('exposes errors and supports an explicit retry', async () => {
    vi.spyOn(apiClient.calendar, 'list')
      .mockResolvedValueOnce({
        status: 403,
        body: { code: 'FORBIDDEN', message: 'Forbidden' },
        headers: new Headers(),
      })
      .mockResolvedValue(response([entry]));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCalendarEntries(projectId, from, to), { wrapper });
    await waitFor(() => expect(result.current.error).toMatchObject({ code: 'FORBIDDEN' }));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.data).toEqual([entry]));
  });

  it.each(['focus', 'reconnect'] as const)(
    'refetches on %s despite provider defaults',
    async (event) => {
      const list = vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(response([entry]));
      const { wrapper } = setup();
      const { result } = renderHook(() => useCalendarEntries(projectId, from, to), { wrapper });
      await waitFor(() => expect(result.current.data).toEqual([entry]));
      const before = list.mock.calls.length;
      list.mockResolvedValue(response([{ ...entry, title: 'Renamed Page' }]));
      act(() => {
        if (event === 'focus') {
          focusManager.setFocused(false);
          focusManager.setFocused(true);
        } else {
          onlineManager.setOnline(false);
          onlineManager.setOnline(true);
        }
      });
      await waitFor(() => expect(result.current.data?.[0].title).toBe('Renamed Page'));
      expect(list.mock.calls.length).toBeGreaterThan(before);
    },
  );

  it('polls after 60 seconds only while mounted and visible', async () => {
    vi.useFakeTimers();
    const list = vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(response([entry]));
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useCalendarEntries(projectId, from, to), {
      wrapper,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.data).toEqual([entry]);
    const before = list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_998);
    });
    expect(list).toHaveBeenCalledTimes(before);
    list.mockResolvedValue(response([{ ...entry, title: 'Polled title' }]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(list.mock.calls.length).toBeGreaterThan(before);
    expect(result.current.data?.[0].title).toBe('Polled title');
    visibility('hidden');
    const hiddenCount = list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(list).toHaveBeenCalledTimes(hiddenCount);
    visibility('visible');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const resumedCount = list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_001);
    });
    expect(list.mock.calls.length).toBeGreaterThan(resumedCount);
    unmount();
    const unmountedCount = list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(list).toHaveBeenCalledTimes(unmountedCount);
  });
});
