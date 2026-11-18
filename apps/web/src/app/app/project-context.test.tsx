// @vitest-environment jsdom
// Автор: OpenAI (GPT-6.1 Sol). Контракт #172 одобрен 2026-11-08; только тесты.
import type { Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pageKeys } from '@/src/entities/page';
import { projectKeys } from '@/src/entities/project';
import { CreatePageProvider } from '@/src/features/create-page';
import { apiClient } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';
import { Sidebar, useSidebarStore } from '@/src/widgets/sidebar';

import CalendarPage from './calendar/page';
import AppPage from './page';

// Только граница Next router: история и подписка, без разрешения проектов.
const navigation = vi.hoisted(() => {
  let entries = ['/app'];
  let index = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    current: () => entries[index],
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: vi.fn((url: string) => {
      entries = [...entries.slice(0, index + 1), url];
      index++;
      emit();
    }),
    replace: vi.fn((url: string) => {
      entries[index] = url;
      emit();
    }),
    back: () => {
      index = Math.max(0, index - 1);
      emit();
    },
    forward: () => {
      index = Math.min(entries.length - 1, index + 1);
      emit();
    },
    reset: (url: string) => {
      entries = [url];
      index = 0;
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  function useUrl() {
    return new URL(
      useSyncExternalStore(navigation.subscribe, navigation.current),
      'http://noto.test',
    );
  }
  return {
    useRouter: () => navigation,
    usePathname: () => useUrl().pathname,
    useSearchParams: () => useUrl().searchParams,
    useParams: () => {
      const segment = useUrl().pathname.split('/')[2];
      return segment && !['calendar', 'trash', 'settings'].includes(segment)
        ? { pageId: segment }
        : {};
    },
  };
});
vi.mock('@/src/widgets/sidebar/ui/sidebar-user-block', () => ({ SidebarUserBlock: () => null }));

const A: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Zulu workspace',
  currentUserRole: 'owner',
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
};
const B: Project = { ...A, id: '00000000-0000-4000-8000-000000000002', name: 'Alpha workspace' };
const note: Page = {
  id: '00000000-0000-4000-8000-000000000003',
  projectId: B.id,
  parentId: null,
  title: 'Second project note',
  content: [],
  position: 0,
  currentUserRole: 'owner',
  createdAt: A.createdAt,
  updatedAt: A.updatedAt,
};
const created: Page = {
  ...note,
  id: '00000000-0000-4000-8000-000000000004',
  title: 'Без названия',
};
const ok = <T,>(body: T) => ({ status: 200 as const, body, headers: new Headers() });
const pageCreated = (page: Page) => ({
  status: 201 as const,
  body: { page },
  headers: new Headers(),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function flushAction(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}
type ListResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;
type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;
type CreateResponse = Awaited<ReturnType<typeof apiClient.pages.create>>;

beforeEach(() => {
  useSidebarStore.setState({ collapsedPageIds: new Set(), isDrawerOpen: false });
  navigation.reset('/app');
  navigation.push.mockClear();
  navigation.replace.mockClear();
  vi.spyOn(apiClient.projects, 'list').mockResolvedValue(ok({ projects: [A, B] }));
  vi.spyOn(apiClient.projects, 'get').mockImplementation(({ params }) =>
    Promise.resolve(ok({ project: params.projectId === A.id ? A : B })),
  );
  vi.spyOn(apiClient.pages, 'get').mockResolvedValue(ok({ page: note }));
  vi.spyOn(apiClient.pages, 'list').mockImplementation(({ params }) =>
    Promise.resolve(ok({ pages: params.projectId === B.id ? [note] : [] })),
  );
  vi.spyOn(apiClient.pages, 'create').mockImplementation(({ params, body }) =>
    Promise.resolve(
      pageCreated({ ...created, projectId: params.projectId, parentId: body.parentId ?? null }),
    ),
  );
  vi.spyOn(apiClient.projects, 'create').mockResolvedValue({
    status: 201,
    body: { project: { ...B, name: 'Мой проект' } },
    headers: new Headers(),
  });
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
});
let activeClient: QueryClient;
afterEach(() => {
  cleanup();
  activeClient?.clear();
  vi.restoreAllMocks();
});

function HomeRoute() {
  return usePathname() === '/app' ? <AppPage /> : null;
}

function CalendarRoute() {
  return usePathname() === '/app/calendar' ? <CalendarPage /> : null;
}

function setup(url: string, includeCalendar = false) {
  navigation.reset(url);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  activeClient = client;
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={client}>
      <CreatePageProvider>
        <Sidebar />
        <HomeRoute />
        {includeCalendar ? <CalendarRoute /> : null}
      </CreatePageProvider>
    </QueryClientProvider>,
  );
  return { ...view, client, invalidate, user: userEvent.setup() };
}
const rootButton = () => screen.getByRole('button', { name: 'Новая страница' });
async function settledList() {
  await waitFor(() => expect(apiClient.projects.list).toHaveBeenCalled());
  await waitFor(() =>
    expect(activeClient.getQueryState(projectKeys.all())?.fetchStatus).toBe('idle'),
  );
}
function expectNoCreation() {
  expect(apiClient.projects.create).not.toHaveBeenCalled();
  expect(apiClient.pages.create).not.toHaveBeenCalled();
}
function expectContextLinks(project: Project) {
  for (const [name, path] of [
    ['Домой', '/app'],
    ['Календарь', '/app/calendar'],
    ['Корзина', '/app/trash'],
  ]) {
    expect(screen.getByRole('link', { name })).toHaveAttribute(
      'href',
      `${path}?projectId=${project.id}`,
    );
  }
  expect(screen.getByRole('link', { name: 'Настройки' })).toHaveAttribute('href', '/app/settings');
}

describe('#172 project context at public app-shell entrypoints', () => {
  it('uses Page metadata over a conflicting query for tree, links and root creation', async () => {
    const { user } = setup(`/app/${note.id}?projectId=${A.id}`);
    expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
    await user.click(rootButton());
    await waitFor(() =>
      expect(apiClient.pages.create).toHaveBeenCalledWith({
        params: { projectId: B.id },
        body: { title: 'Без названия' },
      }),
    );
    expect(apiClient.pages.list).not.toHaveBeenCalledWith({ params: { projectId: A.id } });
    expectContextLinks(B);
  });

  it.each([B, A])(
    'cold renders explicit $name and creates in the same project even when empty',
    async (project) => {
      const { user } = setup(`/app?projectId=${project.id}`);
      await waitFor(() =>
        expect(apiClient.pages.list).toHaveBeenCalledWith({ params: { projectId: project.id } }),
      );
      await waitFor(() => expect(rootButton()).toBeEnabled());
      await user.click(rootButton());
      await waitFor(() =>
        expect(apiClient.pages.create).toHaveBeenCalledWith({
          params: { projectId: project.id },
          body: { title: 'Без названия' },
        }),
      );
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(apiClient.projects.create).not.toHaveBeenCalled();
      // После успешного создания переход уже на Page; проверяем захваченный проект выше.
    },
  );

  it('canonical replaces missing context with the first server project without opening a Page', async () => {
    setup('/app');
    await settledList();
    expect(navigation.replace).toHaveBeenCalledWith(`/app?projectId=${A.id}`);
    expect(navigation.push).not.toHaveBeenCalled();
    await waitFor(() => expectContextLinks(A));
    expectNoCreation();
  });

  it('canonical replaces home after an empty list becomes nonempty without a bootstrap click', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValueOnce(ok({ projects: [] }));
    const { client } = setup('/app');
    await settledList();
    expect(navigation.replace).not.toHaveBeenCalled();
    await act(async () => {
      await client.invalidateQueries({ queryKey: projectKeys.all() });
    });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(`/app?projectId=${A.id}`));
    expectContextLinks(A);
    expectNoCreation();
  });

  it('keeps partial home bootstrap retry in its created project despite a nonempty refresh', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValueOnce(ok({ projects: [] }));
    vi.mocked(apiClient.pages.create).mockRejectedValueOnce(new TypeError('Page network error'));
    const { user } = setup('/app');
    await settledList();
    await user.click(rootButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(navigation.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(rootButton()).toBeEnabled());
    await user.click(rootButton());
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/app/${created.id}`));
    expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
    expect(apiClient.pages.create).toHaveBeenCalledTimes(2);
    for (const [request] of vi.mocked(apiClient.pages.create).mock.calls)
      expect(request.params.projectId).toBe(B.id);
  });

  it('keeps the explicit second project empty instead of switching to a populated first project', async () => {
    vi.mocked(apiClient.pages.list).mockImplementation(({ params }) =>
      Promise.resolve(
        ok({ pages: params.projectId === A.id ? [{ ...note, projectId: A.id }] : [] }),
      ),
    );
    const { user } = setup(`/app?projectId=${B.id}`);
    expect(await screen.findByText('Нет страниц')).toBeVisible();
    expect(apiClient.pages.list).not.toHaveBeenCalledWith({ params: { projectId: A.id } });
    await user.click(rootButton());
    await waitFor(() =>
      expect(apiClient.pages.create).toHaveBeenCalledWith({
        params: { projectId: B.id },
        body: { title: 'Без названия' },
      }),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('does not let a late fallback response overwrite a later explicit navigation', async () => {
    const list = deferred<ListResponse>();
    vi.mocked(apiClient.projects.list).mockReturnValue(list.promise);
    setup('/app');
    act(() => navigation.push(`/app?projectId=${B.id}`));
    await flushAction(() => list.resolve(ok({ projects: [A, B] })));
    await screen.findByRole('link', { name: note.title });
    expect(navigation.current()).toBe(`/app?projectId=${B.id}`);
    expect(navigation.replace).not.toHaveBeenCalled();
    expectContextLinks(B);
  });

  it('does not revive an old fallback intent after leaving and returning to the same URL', async () => {
    const list = deferred<ListResponse>();
    vi.mocked(apiClient.projects.list).mockReturnValue(list.promise);
    setup('/app');
    await flushAction(() => navigation.push('/app/settings'));
    await flushAction(() => navigation.back());
    await flushAction(() => list.resolve(ok({ projects: [A, B] })));
    await waitFor(() => expect(activeClient.isFetching()).toBe(0));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.current()).toBe('/app');
    expectNoCreation();
  });

  it.each(['', 'not-a-uuid', `${A.id}&projectId=${B.id}`])(
    'rejects explicit invalid projectId=%s without requests or silent fallback',
    async (value) => {
      const { user } = setup(`/app?projectId=${value}`);
      await settledList();
      expect(screen.getByText(/невалидный проект/i)).toBeVisible();
      expect(rootButton()).toBeDisabled();
      await user.click(rootButton());
      expectNoCreation();
      expect(apiClient.projects.get).not.toHaveBeenCalled();
      expect(apiClient.pages.list).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );

  it('accepts duplicate identical project parameters', async () => {
    setup(`/app?projectId=${B.id}&projectId=${B.id}`);
    expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
    expectContextLinks(B);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it.each([403, 404] as const)(
    'shows explicit project API %s and never substitutes the first project',
    async (status) => {
      const error = {
        status,
        body: {
          code: status === 403 ? ('FORBIDDEN' as const) : ('NOT_FOUND' as const),
          message: 'Unavailable',
        },
        headers: new Headers(),
      };
      vi.mocked(apiClient.projects.get).mockResolvedValue(error);
      vi.mocked(apiClient.pages.list).mockResolvedValue(error);
      const { user } = setup(`/app?projectId=${B.id}`);
      expect(
        await screen.findByText(status === 403 ? /доступ запрещён/i : /проект недоступен/i),
      ).toBeVisible();
      expect(rootButton()).toBeDisabled();
      await user.click(rootButton());
      expectNoCreation();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(apiClient.pages.list).not.toHaveBeenCalledWith({ params: { projectId: A.id } });
    },
  );

  it('keeps an explicit project usable when it is absent from the navigation list', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [A] }));
    setup(`/app?projectId=${B.id}`);
    expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
    expectContextLinks(B);
    expect(rootButton()).toBeEnabled();
  });

  it('keeps Page context and creation usable despite project-list failure', async () => {
    vi.mocked(apiClient.projects.list).mockRejectedValue(new TypeError('Network error'));
    const { user } = setup(`/app/${note.id}`);
    expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
    expectContextLinks(B);
    expect(rootButton()).toBeEnabled();
    await user.click(rootButton());
    await waitFor(() =>
      expect(apiClient.pages.create).toHaveBeenCalledWith({
        params: { projectId: B.id },
        body: { title: 'Без названия' },
      }),
    );
  });

  it('blocks creation and context links while Page metadata is unresolved instead of using query or list', async () => {
    const page = deferred<PageResponse>();
    vi.mocked(apiClient.pages.get).mockReturnValue(page.promise);
    const { user } = setup(`/app/${note.id}?projectId=${A.id}`);
    await settledList();
    expect(rootButton()).toBeDisabled();
    await user.click(rootButton());
    expectNoCreation();
    expect(apiClient.pages.list).not.toHaveBeenCalled();
    for (const name of ['Домой', 'Календарь', 'Корзина']) {
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.getByRole('link', { name: 'Настройки' })).toHaveAttribute(
      'href',
      '/app/settings',
    );
    await flushAction(() => page.resolve(ok({ page: note })));
    expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
    expectContextLinks(B);
  });

  it('does not create while fallback projects are unresolved', async () => {
    const list = deferred<ListResponse>();
    vi.mocked(apiClient.projects.list).mockReturnValue(list.promise);
    const { user } = setup('/app');
    expect(rootButton()).toBeDisabled();
    await user.click(rootButton());
    expectNoCreation();
    await flushAction(() => list.resolve(ok({ projects: [] })));
    await waitFor(() => expect(rootButton()).toBeEnabled());
    expectNoCreation();
  });

  it.each([403, 404] as const)(
    'does not fall back or create for missing/inaccessible Page (%s)',
    async (status) => {
      vi.mocked(apiClient.pages.get).mockResolvedValue({
        status,
        body: { code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: 'Unavailable' },
        headers: new Headers(),
      });
      const { user } = setup(`/app/${note.id}`);
      await settledList();
      expect(rootButton()).toBeDisabled();
      await user.click(rootButton());
      expectNoCreation();
      expect(apiClient.pages.list).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );

  it.each(['/app/settings', `/app/settings?projectId=${B.id}`, '/app/trash'])(
    'disables root creation on global/chooser route %s',
    async (url) => {
      const { user } = setup(url);
      await settledList();
      expect(rootButton()).toBeDisabled();
      await user.click(rootButton());
      expectNoCreation();
      expect(apiClient.pages.list).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(apiClient.pages.get).not.toHaveBeenCalled();
    },
  );

  it.each(['/app/settings', '/app/trash'])(
    'never bootstraps My Project from an empty list on %s',
    async (url) => {
      vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [] }));
      const { user } = setup(url);
      await settledList();
      expect(rootButton()).toBeDisabled();
      await user.click(rootButton());
      expectNoCreation();
    },
  );

  it.each(['/app', '/app/calendar', '/app/trash'])(
    'preserves explicit section context in links on %s',
    async (route) => {
      setup(`${route}?projectId=${B.id}`);
      expect(await screen.findByRole('link', { name: note.title })).toBeVisible();
      expectContextLinks(B);
    },
  );

  it('creates My Project only after an explicit click on a successfully empty list', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [] }));
    const { user } = setup('/app');
    await settledList();
    expectNoCreation();
    await user.click(rootButton());
    await waitFor(() =>
      expect(apiClient.pages.create).toHaveBeenCalledWith({
        params: { projectId: B.id },
        body: { title: 'Без названия' },
      }),
    );
    expect(apiClient.projects.create).toHaveBeenCalledExactlyOnceWith({
      body: { name: 'Мой проект' },
    });
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/app/${created.id}`));
  });

  it('allows a new explicit bootstrap after canceling an uncertain project intent without remounting the shell', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [] }));
    vi.mocked(apiClient.projects.create).mockRejectedValueOnce(
      new TypeError('Project network error'),
    );
    const { user, client } = setup('/app');
    await settledList();
    const sidebarButton = rootButton();
    const homeButton = () => screen.getByRole('button', { name: 'Создать страницу' });
    await waitFor(() => expect(sidebarButton).toBeEnabled());
    await user.click(sidebarButton);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    await waitFor(() => expect(apiClient.projects.list).toHaveBeenCalledTimes(2));
    await settledList();
    expect(client.getQueryData(projectKeys.all())).toEqual([]);
    expect(sidebarButton).toBeDisabled();
    expect(homeButton()).toBeDisabled();
    await user.click(sidebarButton);
    await user.click(homeButton());
    expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
    expect(apiClient.pages.create).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();

    await flushAction(() => navigation.push('/app/settings'));
    expect(rootButton()).toBe(sidebarButton);
    expect(sidebarButton).toBeDisabled();
    await flushAction(() => navigation.back());
    await settledList();
    expect(rootButton()).toBe(sidebarButton);
    await waitFor(() => expect(sidebarButton).toBeEnabled());
    expect(homeButton()).toBeEnabled();
    expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
    expect(apiClient.pages.create).not.toHaveBeenCalled();
    expect(navigation.current()).toBe('/app');
    expect(navigation.replace).not.toHaveBeenCalled();

    await user.click(homeButton());
    await waitFor(() => expect(navigation.current()).toBe(`/app/${created.id}`));
    expect(apiClient.projects.create).toHaveBeenCalledTimes(2);
    expect(apiClient.pages.create).toHaveBeenCalledExactlyOnceWith({
      params: { projectId: B.id },
      body: { title: 'Без названия' },
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('does not auto-create on a failed project list', async () => {
    vi.mocked(apiClient.projects.list).mockRejectedValue(new TypeError('Network error'));
    const { user } = setup('/app');
    await settledList();
    expect(rootButton()).toBeDisabled();
    await user.click(rootButton());
    expectNoCreation();
  });

  it('completes calendar bootstrap creation after its own canonical replace while Page POST is pending', async () => {
    const project = deferred<Awaited<ReturnType<typeof apiClient.projects.create>>>();
    const refreshedProjects = deferred<ListResponse>();
    const page = deferred<CreateResponse>();
    vi.mocked(apiClient.projects.list)
      .mockResolvedValueOnce(ok({ projects: [] }))
      .mockReturnValue(refreshedProjects.promise);
    vi.mocked(apiClient.projects.create).mockReturnValue(project.promise);
    vi.mocked(apiClient.pages.create).mockReturnValue(page.promise);
    vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(ok({ entries: [] }));

    const { user, client } = setup('/app/calendar', true);
    await settledList();
    expect(screen.getByRole('heading', { name: 'Календарь', level: 1 })).toBeVisible();
    expect(screen.getByText('Нет проектов', { exact: true, selector: 'p' })).toBeVisible();
    expectNoCreation();
    expect(navigation.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(rootButton()).toBeEnabled());
    await user.click(rootButton());
    expect(apiClient.projects.create).toHaveBeenCalledExactlyOnceWith({
      body: { name: 'Мой проект' },
    });
    expect(apiClient.pages.create).not.toHaveBeenCalled();

    await flushAction(() =>
      project.resolve({ status: 201, body: { project: B }, headers: new Headers() }),
    );
    await waitFor(() => expect(apiClient.projects.list).toHaveBeenCalledTimes(2));
    expect(apiClient.pages.create).not.toHaveBeenCalled();
    await flushAction(() => refreshedProjects.resolve(ok({ projects: [B] })));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
    const canonical = new URL(navigation.current(), 'http://noto.test');
    expect(canonical.pathname).toBe('/app/calendar');
    expect(canonical.searchParams.get('projectId')).toBe(B.id);
    expect(canonical.searchParams.get('month')).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(client.getQueryData(projectKeys.all())).toEqual([B]);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(apiClient.pages.create).toHaveBeenCalledExactlyOnceWith({
      params: { projectId: B.id },
      body: { title: 'Без названия' },
    });
    expect(client.isMutating()).toBe(1);
    expect(rootButton()).toBeDisabled();

    await flushAction(() => page.resolve(pageCreated(created)));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
    expect(apiClient.pages.create).toHaveBeenCalledExactlyOnceWith({
      params: { projectId: B.id },
      body: { title: 'Без названия' },
    });
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(`/app/${created.id}`);
    expect(navigation.current()).toBe(`/app/${created.id}`);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(
      'Страница создана',
      `Вы перешли на страницу «${created.title}»`,
    );
  });

  it('does not start the Page step when project creation finishes after navigation away', async () => {
    const project = deferred<Awaited<ReturnType<typeof apiClient.projects.create>>>();
    vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [] }));
    vi.mocked(apiClient.projects.create).mockReturnValue(project.promise);
    const { user } = setup('/app');
    await settledList();
    await user.click(rootButton());
    await waitFor(() => expect(apiClient.projects.create).toHaveBeenCalledTimes(1));
    await flushAction(() => navigation.push('/app/settings'));
    navigation.push.mockClear();
    await flushAction(() =>
      project.resolve({ status: 201, body: { project: B }, headers: new Headers() }),
    );
    await waitFor(() => expect(activeClient.isMutating()).toBe(0));
    expect(apiClient.pages.create).not.toHaveBeenCalled();
    expect(navigation.current()).toBe('/app/settings');
    expect(navigation.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(['project', 'leave-return', 'popstate'])(
    'still expires calendar bootstrap after its canonical replace on real %s navigation',
    async (change) => {
      const page = deferred<CreateResponse>();
      vi.mocked(apiClient.projects.list)
        .mockResolvedValueOnce(ok({ projects: [] }))
        .mockResolvedValue(ok({ projects: [B] }));
      vi.mocked(apiClient.pages.create).mockReturnValue(page.promise);
      vi.spyOn(apiClient.calendar, 'list').mockResolvedValue(ok({ entries: [] }));
      const { user, client, invalidate } = setup('/app/calendar', true);
      await settledList();
      await user.click(rootButton());
      await waitFor(() => expect(apiClient.pages.create).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
      if (change === 'project')
        await flushAction(() => navigation.push(`/app/calendar?projectId=${A.id}`));
      else if (change === 'leave-return') {
        await flushAction(() => navigation.push('/app/settings'));
        await flushAction(() => navigation.back());
      } else await flushAction(() => window.dispatchEvent(new PopStateEvent('popstate')));
      const destination = navigation.current();
      navigation.push.mockClear();
      await flushAction(() => page.resolve(pageCreated(created)));
      await waitFor(() => expect(client.isMutating()).toBe(0));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: pageKeys.list(B.id) });
      expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
      expect(apiClient.pages.create).toHaveBeenCalledTimes(1);
      expect(navigation.current()).toBe(destination);
      expect(navigation.push).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it('retries only Page after partial project success even if the refreshed list is still empty', async () => {
    vi.mocked(apiClient.projects.list).mockResolvedValue(ok({ projects: [] }));
    vi.mocked(apiClient.pages.create).mockRejectedValueOnce(new TypeError('Page network error'));
    const { user } = setup('/app');
    await settledList();
    await user.click(rootButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(navigation.push).not.toHaveBeenCalled();
    await waitFor(() => expect(rootButton()).toBeEnabled());
    await user.click(rootButton());
    await waitFor(() => expect(apiClient.pages.create).toHaveBeenCalledTimes(2));
    expect(apiClient.projects.create).toHaveBeenCalledTimes(1);
    for (const call of vi.mocked(apiClient.pages.create).mock.calls)
      expect(call[0].params.projectId).toBe(B.id);
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/app/${created.id}`));
  });

  it.each([false, true])(
    'does not navigate or toast for stale root success (leave and return: %s)',
    async (returnToSource) => {
      const pending = deferred<CreateResponse>();
      vi.mocked(apiClient.pages.create).mockReturnValue(pending.promise);
      const { user, invalidate } = setup(`/app?projectId=${B.id}`);
      await settledList();
      await user.click(rootButton());
      await waitFor(() => expect(apiClient.pages.create).toHaveBeenCalled());
      await flushAction(() => navigation.push(`/app?projectId=${A.id}`));
      if (returnToSource) await flushAction(() => navigation.back());
      const destination = navigation.current();
      navigation.push.mockClear();
      await flushAction(() => pending.resolve(pageCreated(created)));
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({ queryKey: pageKeys.list(B.id) }),
      );
      expect(invalidate).not.toHaveBeenCalledWith({ queryKey: pageKeys.list(A.id) });
      expect(navigation.current()).toBe(destination);
      expect(navigation.push).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it('retains nested creation project and parent', async () => {
    const { user } = setup(`/app?projectId=${B.id}`);
    await user.click(
      await screen.findByRole('button', { name: `Создать страницу внутри «${note.title}»` }),
    );
    await waitFor(() =>
      expect(apiClient.pages.create).toHaveBeenCalledWith({
        params: { projectId: B.id },
        body: { title: 'Без названия', parentId: note.id },
      }),
    );
  });

  it('does not navigate or invoke the nested expansion callback after leaving the source route', async () => {
    useSidebarStore.getState().togglePage(note.id);
    const pending = deferred<CreateResponse>();
    vi.mocked(apiClient.pages.create).mockReturnValue(pending.promise);
    const { user, invalidate } = setup(`/app?projectId=${B.id}`);
    await user.click(
      await screen.findByRole('button', { name: `Создать страницу внутри «${note.title}»` }),
    );
    await waitFor(() => expect(apiClient.pages.create).toHaveBeenCalled());
    await flushAction(() => navigation.push('/app/settings'));
    navigation.push.mockClear();
    await flushAction(() => pending.resolve(pageCreated({ ...created, parentId: note.id })));
    await waitFor(() => expect(activeClient.isMutating()).toBe(0));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: pageKeys.list(B.id) });
    expect(navigation.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(useSidebarStore.getState().collapsedPageIds.has(note.id)).toBe(true);
  });

  it('switches through the available-project control to home, and back/forward restore URL context', async () => {
    const { user } = setup(`/app/${note.id}`);
    await screen.findByRole('link', { name: note.title });
    const trigger = screen.getByRole('button', { name: /переключить.*(проект|пространство)/i });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveTextContent(B.name);
    await user.click(trigger);
    await waitFor(() =>
      expect(
        screen
          .getAllByText(B.name)
          .some((element) => element !== trigger && !trigger.contains(element)),
      ).toBe(true),
    );
    await user.click(screen.getByText(A.name));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/app?projectId=${A.id}`));
    expect(navigation.current()).toBe(`/app?projectId=${A.id}`);
    await waitFor(() => expectContextLinks(A));
    act(() => navigation.back());
    await screen.findByRole('link', { name: note.title });
    expectContextLinks(B);
    act(() => navigation.forward());
    await waitFor(() => expectContextLinks(A));
    expectNoCreation();
  });

  it('announces the current project, keeps current selection a no-op and restores focus after keyboard close', async () => {
    const { user } = setup(`/app/${note.id}`);
    await screen.findByRole('link', { name: note.title });
    const trigger = screen.getByRole('button', { name: /переключить.*(проект|пространство)/i });
    expect(trigger).toBeEnabled();
    trigger.focus();
    await user.keyboard('{Enter}');
    const current = screen.getAllByText(B.name).find((element) => !trigger.contains(element));
    expect(current).toBeDefined();
    expect(
      current!.closest(
        '[aria-selected="true"], [aria-checked="true"], [aria-current="true"], [aria-current="page"]',
      ),
    ).not.toBeNull();
    expect(current!.closest('[role="menuitem"]')!.querySelector('svg.lucide-check')).toBeVisible();
    expect(screen.getByText(A.name).closest('[role="menuitem"]')!.querySelector('svg')).toBeNull();
    await user.click(current!);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.current()).toBe(`/app/${note.id}`);
    trigger.focus();
    await user.keyboard('{Enter}{Escape}');
    expect(trigger).toHaveFocus();
  });
});
