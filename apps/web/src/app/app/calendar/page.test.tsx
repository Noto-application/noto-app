// @vitest-environment jsdom
import type { CalendarEntry, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarEntryKeys } from '@/src/entities/calendar-entry';
import { ApiClientError, apiClient } from '@/src/shared/api';
import type { MonthGrid } from '@/src/shared/ui/calendar/month-grid';

import CalendarPage from './page';

type GridProps = Parameters<typeof MonthGrid>[0];
type ListResponse = Awaited<ReturnType<typeof apiClient.calendar.list>>;
type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;
const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
  grid: vi.fn<(props: GridProps) => void>(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => navigation.params,
  usePathname: () => '/app/calendar',
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

// Диапазоны — fixtures контракта адаптера, не реализация вычисления сетки.
// Реальные FullCalendar range/date-only/locale проверены в #133.
vi.mock('@/src/shared/ui/calendar/month-grid', () => ({
  MonthGrid: (props: GridProps) => {
    navigation.grid(props);
    const { month, onRangeChange } = props;
    const callback = useRef(onRangeChange);
    useEffect(() => {
      callback.current = onRangeChange;
    }, [onRangeChange]);
    useEffect(() => {
      if (month === '2026-03') callback.current?.({ from: '2026-02-23', to: '2026-04-06' });
      if (month === '2026-04') callback.current?.({ from: '2026-03-30', to: '2026-05-04' });
    }, [month]);
    return (
      <section aria-label={`Сетка ${month}`}>
        {props.items.map((item) => (
          <button key={item.id} onClick={() => props.onItemClick?.(item.id)}>
            {item.label}
          </button>
        ))}
      </section>
    );
  },
}));

const projectId = '00000000-0000-4000-8000-000000000002';
const firstId = '00000000-0000-4000-8000-000000000003';
const projects: Project[] = [
  {
    id: firstId,
    name: 'Первый в ответе сервера',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: projectId,
    name: 'Альфа',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];
const entries: CalendarEntry[] = [
  {
    pageId: '00000000-0000-4000-8000-000000000010',
    projectId,
    title: 'Февральская Page',
    date: '2026-02-23',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    pageId: '00000000-0000-4000-8000-000000000011',
    projectId,
    title: 'Заголовок Page',
    date: '2026-03-29',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    pageId: '00000000-0000-4000-8000-000000000012',
    projectId,
    title: 'Апрельская Page',
    date: '2026-04-05',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];
const success = (items = entries): ListResponse => ({
  status: 200,
  body: { entries: items },
  headers: new Headers(),
});
const projectSuccess = (items = projects): ProjectsResponse => ({
  status: 200,
  body: { projects: items },
  headers: new Headers(),
});
const clients: QueryClient[] = [];
const originalTZ = process.env.TZ;

function open(query = `projectId=${projectId}&month=2026-03`) {
  navigation.params = new URLSearchParams(query);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  clients.push(client);
  const tree = (
    <QueryClientProvider client={client}>
      <CalendarPage />
    </QueryClientProvider>
  );
  const view = render(tree);
  return {
    ...view,
    client,
    visit(queryString: string) {
      navigation.params = new URLSearchParams(queryString);
      view.rerender(
        <QueryClientProvider client={client}>
          <CalendarPage />
        </QueryClientProvider>,
      );
    },
  };
}

function expectCalendarUrl(value: string, project: string, month: string) {
  const url = new URL(value, 'http://localhost');
  expect(url.pathname).toBe('/app/calendar');
  expect(url.searchParams.get('projectId')).toBe(project);
  expect(url.searchParams.get('month')).toBe(month);
}

beforeEach(() => {
  // Обычные сценарии фиксируют локальный март; граничные timezone проверяются ниже.
  // Подменяется только Date, не таймеры Query/RTL.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 31, 23, 30));
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.grid.mockReset();
  vi.spyOn(apiClient.projects, 'list').mockResolvedValue(projectSuccess());
  vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(success());
  vi.spyOn(apiClient.calendar, 'create').mockRejectedValue(new Error('Unexpected write'));
  vi.spyOn(apiClient.calendar, 'update').mockRejectedValue(new Error('Unexpected write'));
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.useRealTimers();
  // Стандартный Vitest forks изолирует файл; кейсы здесь не concurrent.
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('/app/calendar — #135 read-only', () => {
  it('opens the explicit URL, shows Page titles including adjacent days, and navigates cards', async () => {
    open();
    for (const entry of entries)
      expect(await screen.findByRole('button', { name: entry.title })).toBeInTheDocument();
    const items = navigation.grid.mock.lastCall?.[0].items;
    expect(items).toHaveLength(3);
    expect(items).toEqual(
      expect.arrayContaining([
        { id: entries[0].pageId, label: entries[0].title, date: '2026-02-23' },
        { id: entries[1].pageId, label: entries[1].title, date: '2026-03-29' },
        { id: entries[2].pageId, label: entries[2].title, date: '2026-04-05' },
      ]),
    );
    expect(screen.getByRole('region', { name: 'Сетка 2026-03' })).toBeInTheDocument();
    expect(screen.getByText('Альфа', { exact: true })).toBeVisible();
    expect(apiClient.calendar.list).toHaveBeenCalledWith({
      params: { projectId },
      query: { from: '2026-02-23', to: '2026-04-06' },
    });
    // Никакого bootstrap-запроса только на календарные 1–31 или другой проект.
    for (const [args] of vi.mocked(apiClient.calendar.list).mock.calls) {
      expect(args).toMatchObject({
        params: { projectId },
        query: { from: '2026-02-23', to: '2026-04-06' },
      });
    }
    fireEvent.click(screen.getByRole('button', { name: entries[1].title }));
    expect(navigation.push).toHaveBeenCalledWith(`/app/${entries[1].pageId}`);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('waits for projects, replaces with the first in server order, and visibly selects it', async () => {
    let resolve!: (value: ProjectsResponse) => void;
    vi.mocked(apiClient.projects.list).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    vi.mocked(apiClient.calendar.list).mockResolvedValue(success([]));
    const view = open('month=2026-03');
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(apiClient.calendar.list).not.toHaveBeenCalled();
    await act(async () => {
      resolve(projectSuccess());
      await Promise.resolve();
    });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
    const url = navigation.replace.mock.calls[0][0];
    expectCalendarUrl(url, firstId, '2026-03');
    view.visit(new URL(url, 'http://localhost').search.slice(1));
    expect(await screen.findByText(projects[0].name, { exact: true })).toBeVisible();
    await waitFor(() =>
      expect(apiClient.calendar.list).toHaveBeenCalledWith({
        params: { projectId: firstId },
        query: { from: '2026-02-23', to: '2026-04-06' },
      }),
    );
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('shows no-project empty state without an entries request', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValue(projectSuccess([]));
    open('month=2026-03');
    expect(await screen.findByText(/нет проект/i)).toBeVisible();
    expect(apiClient.calendar.list).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it.each([
    {
      zone: 'America/Los_Angeles',
      instant: '2026-04-01T06:30:00.000Z',
      month: '2026-03',
      utcMonth: '2026-04',
      localMonth: 2,
      day: 31,
      hour: 23,
      offset: 420,
    },
    {
      zone: 'Asia/Tokyo',
      instant: '2026-03-31T15:30:00.000Z',
      month: '2026-04',
      utcMonth: '2026-03',
      localMonth: 3,
      day: 1,
      hour: 0,
      offset: -540,
    },
  ])(
    'canonicalizes an absent month using local time in $zone, not the opposite UTC month',
    async ({ zone, instant, month, utcMonth, localMonth, day, hour, offset }) => {
      process.env.TZ = zone;
      vi.setSystemTime(new Date(instant));
      const now = new Date();
      // Проверяем реальный offset/поля worker: одна запись в process.env не доказательство.
      expect([
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getTimezoneOffset(),
      ]).toEqual([2026, localMonth, day, hour, 30, offset]);
      expect(now.toISOString().slice(0, 7)).toBe(utcMonth);
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
      open(`projectId=${projectId}`);
      await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
      expectCalendarUrl(navigation.replace.mock.calls[0][0], projectId, month);
      expect(navigation.push).not.toHaveBeenCalled();
    },
  );

  it.each([
    'projectId=not-a-uuid&month=2026-03',
    'projectId=&month=2026-03',
    `projectId=${projectId}&month=`,
    `projectId=${projectId}&month=2026-13`,
    `projectId=${projectId}&month=2026-00`,
    `projectId=${projectId}&month=2026-3`,
  ])('rejects invalid syntax without fetching entries: %s', async (query) => {
    open(query);
    expect(await screen.findByText(/невалидная ссылка/i)).toBeVisible();
    expect(apiClient.calendar.list).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('offers recovery from an invalid link to an available project and current month', async () => {
    open('projectId=bad&month=bad');
    fireEvent.click(await screen.findByRole('button', { name: /открыть календарь/i }));
    const destinations = [...navigation.replace.mock.calls, ...navigation.push.mock.calls];
    expect(destinations).toHaveLength(1);
    expectCalendarUrl(destinations[0][0], firstId, '2026-03');
  });

  it.each([
    [403, 'FORBIDDEN', /доступ запрещён/i],
    [404, 'NOT_FOUND', /проект недоступен/i],
  ] as const)('shows %s without falling back or inferring a role', async (status, code, text) => {
    vi.mocked(apiClient.calendar.list).mockResolvedValue({
      status,
      body: { code, message: 'Unavailable' },
      headers: new Headers(),
    });
    open();
    expect(await screen.findByText(text)).toBeVisible();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    for (const [args] of vi.mocked(apiClient.calendar.list).mock.calls)
      expect(args.params.projectId).toBe(projectId);
    expect(screen.queryByText(/viewer|editor|owner|только чтение|роль:/i)).not.toBeInTheDocument();
  });

  it('shows projects loading/error and retries before resolving a missing project', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(apiClient.projects.list).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    open('month=2026-03');
    expect(screen.getByRole('status')).toHaveTextContent(/загруз/i);
    expect(apiClient.calendar.list).not.toHaveBeenCalled();
    await act(async () => {
      reject(new TypeError('Offline'));
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось загрузить проекты/i);
    fireEvent.click(screen.getByRole('button', { name: /повторить/i }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
    expectCalendarUrl(navigation.replace.mock.calls[0][0], firstId, '2026-03');
  });

  it('shows entries loading, error + retry, then empty state', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(apiClient.calendar.list)
      .mockReturnValueOnce(
        new Promise((_, fail) => {
          reject = fail;
        }),
      )
      .mockResolvedValue(success([]));
    open();
    await waitFor(() => expect(apiClient.calendar.list).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent(/загруз/i);
    await act(async () => {
      reject(new TypeError('Offline'));
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось загрузить календарь/i);
    fireEvent.click(screen.getByRole('button', { name: /повторить/i }));
    expect(await screen.findByText(/нет запланированных страниц/i)).toBeVisible();
  });

  it.each([
    { failure: 'network', cache: 'populated' },
    { failure: '500', cache: 'populated' },
    { failure: 'network', cache: 'empty' },
  ] as const)(
    'keeps $cache cached data after a transient background $failure failure and retries without blocking the grid',
    async ({ failure, cache }) => {
      const cached = cache === 'empty' ? [] : entries;
      vi.mocked(apiClient.calendar.list).mockResolvedValue(success(cached));
      const { client } = open();
      const key = calendarEntryKeys.range(projectId, '2026-02-23', '2026-04-06');
      for (const entry of cached)
        expect(await screen.findByRole('button', { name: entry.title })).toBeVisible();
      await waitFor(() => {
        expect(client.getQueryData(key)).toEqual(cached);
        expect(client.getQueryState(key)?.fetchStatus).toBe('idle');
      });
      expect(screen.getByRole('region', { name: 'Сетка 2026-03' })).toBeVisible();

      const networkError = new TypeError('Network unavailable during background refetch');
      if (failure === 'network') vi.mocked(apiClient.calendar.list).mockRejectedValue(networkError);
      else
        vi.mocked(apiClient.calendar.list).mockResolvedValue({
          status: 500,
          body: { code: 'INTERNAL', message: 'Temporary server failure' },
          headers: new Headers(),
        } satisfies ListResponse);
      await act(async () => {
        await client.refetchQueries({ queryKey: key, exact: true });
      });
      await waitFor(() => {
        expect(client.getQueryState(key)).toMatchObject({ status: 'error', fetchStatus: 'idle' });
        if (failure === 'network') expect(client.getQueryState(key)?.error).toBe(networkError);
        else {
          expect(client.getQueryState(key)?.error).toBeInstanceOf(ApiClientError);
          expect(client.getQueryState(key)?.error).toMatchObject({ code: 'INTERNAL' });
        }
      });
      expect(client.getQueryData(key)).toEqual(cached);
      expect(screen.getByRole('region', { name: 'Сетка 2026-03' })).toBeVisible();
      for (const entry of cached) {
        expect(screen.getByRole('button', { name: entry.title })).toBeVisible();
        expect(screen.getByRole('button', { name: entry.title })).toBeEnabled();
      }
      if (cache === 'empty') expect(screen.getByText(/нет запланированных страниц/i)).toBeVisible();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(/не удалось обновить календарь/i);
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(navigation.push).not.toHaveBeenCalled();

      const updated = [{ ...entries[1], title: 'Page after successful retry' }];
      vi.mocked(apiClient.calendar.list).mockResolvedValue(success(updated));
      const callsBeforeRetry = vi.mocked(apiClient.calendar.list).mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: /повторить/i }));
      expect(await screen.findByRole('button', { name: updated[0].title })).toBeVisible();
      await waitFor(() => {
        expect(client.getQueryState(key)).toMatchObject({ status: 'success', fetchStatus: 'idle' });
        expect(client.getQueryData(key)).toEqual(updated);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
      expect(vi.mocked(apiClient.calendar.list).mock.calls.length).toBeGreaterThan(
        callsBeforeRetry,
      );
      for (const entry of cached)
        expect(screen.queryByRole('button', { name: entry.title })).not.toBeInTheDocument();
      expect(screen.queryByText(/нет запланированных страниц/i)).not.toBeInTheDocument();
    },
  );

  it.each([
    [401, 'UNAUTHORIZED', /не удалось загрузить календарь/i],
    [403, 'FORBIDDEN', /доступ запрещён/i],
    [404, 'NOT_FOUND', /проект недоступен/i],
  ] as const)(
    'hides cached cards after background %s (%s), without falling back',
    async (status, code, text) => {
      const { client } = open();
      const key = calendarEntryKeys.range(projectId, '2026-02-23', '2026-04-06');
      for (const entry of entries)
        expect(await screen.findByRole('button', { name: entry.title })).toBeVisible();
      await waitFor(() => {
        expect(client.getQueryData(key)).toEqual(entries);
        expect(client.getQueryState(key)?.fetchStatus).toBe('idle');
      });
      vi.mocked(apiClient.calendar.list).mockResolvedValue({
        status,
        body: { code, message: 'Access no longer available' },
        headers: new Headers(),
      } satisfies ListResponse);
      await act(async () => {
        await client.refetchQueries({ queryKey: key, exact: true });
      });
      await waitFor(() => {
        expect(client.getQueryState(key)).toMatchObject({
          status: 'error',
          fetchStatus: 'idle',
          error: { code },
        });
      });
      expect(await screen.findByText(text)).toBeVisible();
      expect(screen.queryByRole('region', { name: 'Сетка 2026-03' })).not.toBeInTheDocument();
      for (const entry of entries)
        expect(screen.queryByRole('button', { name: entry.title })).not.toBeInTheDocument();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(navigation.push).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Предыдущий месяц', '2026-03', '2026-02'],
    ['Следующий месяц', '2026-03', '2026-04'],
    ['Сегодня', '2026-04', '2026-03'],
    ['Предыдущий месяц', '2026-01', '2025-12'],
    ['Следующий месяц', '2026-12', '2027-01'],
  ])('pushes URL for %s (%s → %s), preserving the project', async (label, month, expected) => {
    open(`projectId=${projectId}&month=${month}`);
    fireEvent.click(await screen.findByRole('button', { name: label }));
    expect(navigation.push).toHaveBeenCalledTimes(1);
    expectCalendarUrl(navigation.push.mock.calls[0][0], projectId, expected);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('renders back/forward URL and new project/range without a push feedback loop', async () => {
    vi.mocked(apiClient.calendar.list).mockImplementation(({ params, query }) =>
      Promise.resolve(
        success([
          {
            ...entries[1],
            projectId: params.projectId,
            title: `${params.projectId}:${query.from}`,
          },
        ]),
      ),
    );
    const view = open();
    expect(await screen.findByRole('button', { name: `${projectId}:2026-02-23` })).toBeVisible();
    view.visit(`projectId=${firstId}&month=2026-04`);
    expect(await screen.findByRole('button', { name: `${firstId}:2026-03-30` })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: `${projectId}:2026-02-23` }),
    ).not.toBeInTheDocument();
    expect(apiClient.calendar.list).toHaveBeenCalledWith({
      params: { projectId: firstId },
      query: { from: '2026-03-30', to: '2026-05-04' },
    });
    view.visit(`projectId=${projectId}&month=2026-03`);
    expect(await screen.findByRole('button', { name: `${projectId}:2026-02-23` })).toBeVisible();
    view.visit(`projectId=${firstId}&month=2026-04`);
    expect(await screen.findByRole('button', { name: `${firstId}:2026-03-30` })).toBeVisible();
    for (const [args] of vi.mocked(apiClient.calendar.list).mock.calls) {
      expect(args.query).toEqual(
        args.params.projectId === projectId
          ? { from: '2026-02-23', to: '2026-04-06' }
          : { from: '2026-03-30', to: '2026-05-04' },
      );
    }
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('removes old project cards while the next project is loading, then renders its cards', async () => {
    let resolveNext!: (value: ListResponse) => void;
    const nextResponse = new Promise<ListResponse>((resolve) => {
      resolveNext = resolve;
    });
    const nextEntry: CalendarEntry = {
      ...entries[1],
      pageId: '00000000-0000-4000-8000-000000000020',
      projectId: firstId,
      title: 'New project Page',
      date: '2026-04-01',
    };
    vi.mocked(apiClient.calendar.list).mockImplementation(({ params }) =>
      params.projectId === projectId ? Promise.resolve(success()) : nextResponse,
    );
    const view = open();
    for (const entry of entries)
      expect(await screen.findByRole('button', { name: entry.title })).toBeVisible();
    navigation.grid.mockClear();
    view.visit(`projectId=${firstId}&month=2026-04`);
    await waitFor(() =>
      expect(apiClient.calendar.list).toHaveBeenCalledWith({
        params: { projectId: firstId },
        query: { from: '2026-03-30', to: '2026-05-04' },
      }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/загруз/i);
    for (const entry of entries)
      expect(screen.queryByRole('button', { name: entry.title })).not.toBeInTheDocument();
    for (const [props] of navigation.grid.mock.calls) {
      expect(props.items.some((item) => entries.some((entry) => entry.pageId === item.id))).toBe(
        false,
      );
    }
    await act(async () => {
      resolveNext(success([nextEntry]));
      await nextResponse;
    });
    expect(await screen.findByRole('button', { name: nextEntry.title })).toBeVisible();
    for (const entry of entries)
      expect(screen.queryByRole('button', { name: entry.title })).not.toBeInTheDocument();
    expect(navigation.grid.mock.lastCall?.[0].items).toEqual([
      { id: nextEntry.pageId, label: nextEntry.title, date: '2026-04-01' },
    ]);
  });

  it('keeps card navigation but exposes no mutation callbacks, controls, forms or role indication', async () => {
    open();
    expect(await screen.findByRole('button', { name: entries[1].title })).toBeEnabled();
    for (const [props] of navigation.grid.mock.calls as [GridProps][])
      expect(props.onDateClick).toBeUndefined();
    expect(
      screen.queryByRole('button', { name: /создать|назначить дату|сменить дату|снять дату/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/viewer|editor|owner|роль:/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: entries[1].title }));
    expect(navigation.push).toHaveBeenCalledWith(`/app/${entries[1].pageId}`);
    expect(apiClient.calendar.create).not.toHaveBeenCalled();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
  });
});
