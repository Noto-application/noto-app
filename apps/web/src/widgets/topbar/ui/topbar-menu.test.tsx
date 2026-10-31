// @vitest-environment jsdom
import type { CalendarEntry, Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarEntryKeys } from '@/src/entities/calendar-entry';
import { pageKeys } from '@/src/entities/page';
import { projectKeys } from '@/src/entities/project/api/projects';
import { apiClient } from '@/src/shared/api';

import { TopbarMenu } from './topbar-menu';

const navigation = vi.hoisted(() => ({ pageId: undefined as string | undefined, push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ pageId: navigation.pageId }),
  useRouter: () => ({ push: navigation.push }),
}));
const projectId = '00000000-0000-4000-8000-000000000002';
const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId,
  parentId: '00000000-0000-4000-8000-000000000003',
  title: 'Nested Page',
  content: [],
  position: 0,
  currentUserRole: 'viewer',
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
};
const project: Project = {
  id: projectId,
  name: 'Project',
  currentUserRole: 'editor',
  createdAt: page.createdAt,
  updatedAt: page.updatedAt,
};
const entry: CalendarEntry = {
  pageId: page.id,
  projectId,
  title: page.title,
  date: '2027-12-25',
  updatedAt: page.updatedAt,
};
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(calendarEntryKeys.range(projectId, '2026-10-26', '2026-12-07'), []);
  const view = render(
    <QueryClientProvider client={client}>
      <TopbarMenu />
    </QueryClientProvider>,
  );
  return { ...view, client };
}
async function openMenu() {
  const button = await screen.findByRole('button', { name: 'Меню страницы' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole('menu')).toBeVisible();
}

async function flushReactTurn() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

async function readyContext(client: QueryClient, role: unknown) {
  await waitFor(() => {
    expect(client.getQueryData(pageKeys.detail(page.id))).toMatchObject({
      id: page.id,
      currentUserRole: 'owner',
    });
    const loadedProject =
      client.getQueryData<Project>(projectKeys.detail(projectId)) ??
      client.getQueryData<Project[]>(projectKeys.all())?.find((item) => item.id === projectId);
    expect(loadedProject).toMatchObject({ id: projectId, currentUserRole: role });
    expect(client.isFetching()).toBe(0);
  });
  await flushReactTurn();
}

async function inspectReadOnlyMenu() {
  const button = screen.getByRole('button', { name: 'Меню страницы' });
  if (button.hasAttribute('disabled')) {
    expect(button).toBeDisabled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  } else {
    expect(button).toBeEnabled();
    await openMenu();
    expect(screen.getByRole('menu')).toBeVisible();
  }
  await flushReactTurn();
  expect(dateActions()).toHaveLength(0);
}
function dateActions() {
  return screen.queryAllByRole('menuitem', { name: /назначить дату|сменить дату|снять дату/i });
}
beforeEach(() => {
  navigation.pageId = page.id;
  navigation.push.mockReset();
  vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
    status: 200,
    body: { page },
    headers: new Headers(),
  });
  vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
    status: 200,
    body: { project },
    headers: new Headers(),
  });
  vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
    status: 200,
    body: { projects: [project] },
    headers: new Headers(),
  });
  vi.spyOn(apiClient.calendar, 'get').mockResolvedValue({
    status: 200,
    body: { entry: null },
    headers: new Headers(),
  });
  vi.spyOn(apiClient.calendar, 'list');
  vi.spyOn(apiClient.calendar, 'update').mockResolvedValue({
    status: 200,
    body: { entry },
    headers: new Headers(),
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe('TopbarMenu calendar action (#136)', () => {
  it.each(['owner', 'editor'] as const)(
    'uses Project %s, not Page viewer, and verified null before assigning',
    async (role) => {
      vi.mocked(apiClient.projects.get).mockResolvedValue({
        status: 200,
        body: { project: { ...project, currentUserRole: role } },
        headers: new Headers(),
      });
      vi.mocked(apiClient.projects.list).mockResolvedValue({
        status: 200,
        body: { projects: [{ ...project, currentUserRole: role }] },
        headers: new Headers(),
      });
      setup();
      await openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Назначить дату' }));
      const date = await screen.findByLabelText('Дата');
      fireEvent.change(date, { target: { value: '2026-11-01' } });
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() =>
        expect(apiClient.calendar.update).toHaveBeenCalledWith({
          params: { projectId, pageId: page.id },
          body: { date: '2026-11-01', expectedDate: null },
        }),
      );
      expect(apiClient.calendar.get).toHaveBeenCalledWith({
        params: { projectId, pageId: page.id },
      });
      expect(apiClient.calendar.list).not.toHaveBeenCalled();
    },
  );

  it('reads an out-of-month date on a cold cache, never inferring null from an empty range', async () => {
    let resolve!: (value: {
      status: 200;
      body: { entry: CalendarEntry };
      headers: Headers;
    }) => void;
    vi.mocked(apiClient.calendar.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    await openMenu();
    await waitFor(() => expect(apiClient.calendar.get).toHaveBeenCalled());
    expect(screen.queryByRole('menuitem', { name: 'Назначить дату' })).not.toBeInTheDocument();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
    act(() => resolve({ status: 200, body: { entry }, headers: new Headers() }));
    expect(await screen.findByRole('menuitem', { name: 'Сменить дату' })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: 'Снять дату' })).toBeEnabled();
    expect(apiClient.calendar.list).not.toHaveBeenCalled();
  });

  it('keeps a failed point read unknown, exposes retry and never probes with PUT', async () => {
    vi.mocked(apiClient.calendar.get).mockRejectedValueOnce(new TypeError('Network error'));
    setup();
    await openMenu();
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Назначить дату' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('menuitem', { name: 'Назначить дату' })).toBeEnabled();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
  });

  it.each(['viewer', undefined, 'unexpected'])(
    'does not use Page owner to grant actions for Project role %s',
    async (role) => {
      vi.mocked(apiClient.pages.get).mockResolvedValue({
        status: 200,
        body: { page: { ...page, currentUserRole: 'owner' } },
        headers: new Headers(),
      });
      const rawProject = { ...project, currentUserRole: role };
      vi.mocked(apiClient.projects.get).mockResolvedValue({
        status: 200,
        body: { project: rawProject },
        headers: new Headers(),
      } as never);
      vi.mocked(apiClient.projects.list).mockResolvedValue({
        status: 200,
        body: { projects: [rawProject] },
        headers: new Headers(),
      } as never);
      const view = setup();
      await readyContext(view.client, role);
      await inspectReadOnlyMenu();
      expect(apiClient.calendar.update).not.toHaveBeenCalled();
    },
  );

  it('does not expose date actions while Project role is loading', async () => {
    vi.mocked(apiClient.projects.get).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.projects.list).mockReturnValue(new Promise(() => {}));
    const view = setup();
    await waitFor(() => {
      expect(view.client.getQueryData(pageKeys.detail(page.id))).toEqual(page);
      expect(view.client.isFetching({ queryKey: projectKeys.all() })).toBeGreaterThan(0);
    });
    await flushReactTurn();
    await inspectReadOnlyMenu();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
  });

  it('does not request or offer assignment without a current Page', async () => {
    navigation.pageId = undefined;
    const view = setup();
    await flushReactTurn();
    await waitFor(() => expect(view.client.isFetching()).toBe(0));
    await inspectReadOnlyMenu();
    await waitFor(() => expect(view.client.isFetching()).toBe(0));
    expect(apiClient.pages.get).not.toHaveBeenCalled();
    expect(apiClient.calendar.get).not.toHaveBeenCalled();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
  });
});
