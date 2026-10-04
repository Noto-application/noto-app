// @vitest-environment jsdom
import type { Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider, type MutateOptions } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageKeys } from '@/src/entities/page/api/pages';
import { projectKeys } from '@/src/entities/project/api/projects';
import { apiClient } from '@/src/shared/api';
import { Toaster } from '@/src/shared/ui/toast';

import { CreatePageProvider } from '../model/create-page-context';
import { CreatePageButton } from '../ui/create-page-button';
import { useCreatePage } from './use-create-page';

const push = vi.fn();
const paramsRef: { current: { pageId?: string } } = { current: {} };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => paramsRef.current,
}));

type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;
type CreateProjectResponse = Awaited<ReturnType<typeof apiClient.projects.create>>;
type CreatePageResponse = Awaited<ReturnType<typeof apiClient.pages.create>>;
type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;

type CreatePageVariables = { title?: string; parentId?: string | null };
type CreatePageMutateOptions = MutateOptions<Page, Error, CreatePageVariables | undefined>;
type PendingCreate = {
  resolve: (response: CreatePageResponse) => void;
  reject: (error: unknown) => void;
};

/**
 * Мок `pages.create`, отдающий управляемые промисы: тест сам решает, в каком
 * порядке и с каким исходом завершать параллельные запросы.
 */
function mockPendingCreate() {
  const pending: PendingCreate[] = [];
  const create = vi.spyOn(apiClient.pages, 'create').mockImplementation(
    () =>
      new Promise<CreatePageResponse>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  );

  return { create, pending };
}

const project: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Мой проект',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

const otherProject: Project = {
  ...project,
  id: '00000000-0000-4000-8000-000000000005',
  name: 'Второй проект',
};

const page: Page = {
  id: '00000000-0000-4000-8000-000000000002',
  projectId: project.id,
  parentId: null,
  title: 'Без названия',
  content: [],
  position: 0,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    queryClient,
    invalidateQueries,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  paramsRef.current = {};
});

describe('useCreatePage', () => {
  it('без явного projectId использует проект открытой страницы, а не первый в списке', async () => {
    const openPage: Page = { ...page, projectId: otherProject.id };
    paramsRef.current = { pageId: openPage.id };
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page: openPage },
      headers: new Headers(),
    } satisfies PageResponse);
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page: { ...page, projectId: otherProject.id } },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: otherProject.id },
      body: { title: 'Без названия' },
    });
  });

  it('ошибка загрузки открытой страницы не считается ошибкой списка проектов', async () => {
    paramsRef.current = { pageId: page.id };
    vi.spyOn(apiClient.pages, 'get').mockRejectedValue(new TypeError('Network error'));
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectError).toBe(true));

    expect(result.current.isProjectsError).toBe(false);
  });

  it('без pageId и с ещё не загруженными проектами остаётся в isActiveProjectPending, не зависая из-за отключённого usePage', () => {
    let resolveList: (response: ProjectsResponse) => void = () => undefined;
    vi.spyOn(apiClient.projects, 'list').mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    expect(result.current.isActiveProjectPending).toBe(true);
    expect(result.current.isActiveProjectError).toBe(false);

    resolveList({ status: 200, body: { projects: [] }, headers: new Headers() });
  });

  it('если открытая страница не найдена, при создании страницы использует список проектов', async () => {
    paramsRef.current = { pageId: page.id };
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies PageResponse);
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    expect(result.current.isActiveProjectError).toBe(false);

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'Без названия' },
    });
  });

  it('создаёт страницу с названием по умолчанию, инвалидирует список и переходит к ней', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper, invalidateQueries } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'Без названия' },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pageKeys.list(project.id) });
    expect(push).toHaveBeenCalledWith(`/app/${page.id}`);
  });

  it('передаёт указанные название и родительскую страницу', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page: { ...page, title: 'План проекта' } },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate({ title: 'План проекта', parentId: page.id }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'План проекта', parentId: page.id },
    });
  });

  it('вложенное создание: инвалидация завершается до раскрытия родителя и перехода', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page: { ...page, parentId: 'parent' } },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper, invalidateQueries } = createWrapper();
    let finishInvalidation: () => void = () => undefined;
    invalidateQueries.mockImplementation(
      () => new Promise<void>((resolve) => (finishInvalidation = resolve)),
    );
    const expandParent = vi.fn<(parentId: string) => void>();
    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() =>
      result.current.mutate({ parentId: 'parent' }, { onSuccess: () => expandParent('parent') }),
    );
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pageKeys.list(project.id) }),
    );
    expect(expandParent).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    act(() => finishInvalidation());
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${page.id}`));
    expect(expandParent).toHaveBeenCalledExactlyOnceWith('parent');
    expect(invalidateQueries.mock.invocationCallOrder[0]).toBeLessThan(
      expandParent.mock.invocationCallOrder[0],
    );
    expect(expandParent.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('после размонтирования вложенное создание всё равно инвалидирует список, раскрывает родителя и переходит', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const createdPage: Page = { ...page, parentId: 'parent' };
    let resolveCreate: (response: CreatePageResponse) => void = () => undefined;
    const pendingCreate = new Promise<CreatePageResponse>((resolve) => {
      resolveCreate = resolve;
    });
    const create = vi.spyOn(apiClient.pages, 'create').mockReturnValue(pendingCreate);
    const { Wrapper, invalidateQueries } = createWrapper();
    const expandParent = vi.fn<(parentId: string) => void>();
    const { result, unmount } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() =>
      result.current.mutate({ parentId: 'parent' }, { onSuccess: () => expandParent('parent') }),
    );
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    // Компонент уходит со сцены раньше, чем API отвечает: колбэки не должны
    // теряться вместе с наблюдателем мутации.
    unmount();

    act(() => {
      resolveCreate({ status: 201, body: { page: createdPage }, headers: new Headers() });
    });

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pageKeys.list(project.id) }),
    );
    await waitFor(() => expect(expandParent).toHaveBeenCalledExactlyOnceWith('parent'));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${createdPage.id}`));
    expect(invalidateQueries.mock.invocationCallOrder[0]).toBeLessThan(
      expandParent.mock.invocationCallOrder[0],
    );
    expect(expandParent.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('колбэк второго параллельного создания не вызывается со страницей первого', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { create, pending } = mockPendingCreate();
    const { Wrapper } = createWrapper();
    const parentA = 'parent-A';
    const parentB = 'parent-B';
    const pageA: Page = { ...page, id: '00000000-0000-4000-8000-0000000000aa', parentId: parentA };
    const pageB: Page = { ...page, id: '00000000-0000-4000-8000-0000000000bb', parentId: parentB };
    const successB = vi.fn<(created: Page, variables?: CreatePageVariables) => void>();

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));

    act(() => {
      result.current.mutate({ parentId: parentA });
      result.current.mutate({ parentId: parentB }, { onSuccess: successB });
    });

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenNthCalledWith(1, {
      params: { projectId: project.id },
      body: { title: 'Без названия', parentId: parentA },
    });
    expect(create).toHaveBeenNthCalledWith(2, {
      params: { projectId: project.id },
      body: { title: 'Без названия', parentId: parentB },
    });

    act(() => pending[0].resolve({ status: 201, body: { page: pageA }, headers: new Headers() }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${pageA.id}`));

    // Пока завершилось только создание A, колбэк B ещё не должен сработать:
    // тем более он не может получить страницу A.
    expect(successB).not.toHaveBeenCalled();

    act(() => pending[1].resolve({ status: 201, body: { page: pageB }, headers: new Headers() }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${pageB.id}`));

    // Переходы идут в порядке завершения запросов, каждый — к своей странице.
    expect(push).toHaveBeenNthCalledWith(1, `/app/${pageA.id}`);
    expect(push).toHaveBeenNthCalledWith(2, `/app/${pageB.id}`);

    // Колбэк B получает страницу и переменные именно своего вызова.
    expect(successB).toHaveBeenCalledTimes(1);
    expect(successB.mock.calls[0][0]).toBe(pageB);
    expect(successB.mock.calls[0][1]).toMatchObject({ parentId: parentB });
  });

  it('ошибка первого из параллельных созданий не сбрасывает onSuccess второго', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { pending } = mockPendingCreate();
    const { Wrapper } = createWrapper();
    const parentA = 'parent-A';
    const parentB = 'parent-B';
    const pageB: Page = { ...page, id: '00000000-0000-4000-8000-0000000000bb', parentId: parentB };
    const successB = vi.fn<(created: Page, variables?: CreatePageVariables) => void>();
    const failure = new Error('create failed');

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));

    act(() => {
      result.current.mutate({ parentId: parentA });
      result.current.mutate({ parentId: parentB }, { onSuccess: successB });
    });

    await waitFor(() => expect(pending).toHaveLength(2));

    act(() => pending[0].reject(failure));

    // Дожидаемся обработки ошибки A на уровне хука (toast), прежде чем
    // завершать B — иначе порядок реакций недетерминирован.
    await screen.findByText('Не удалось создать страницу');

    act(() => pending[1].resolve({ status: 201, body: { page: pageB }, headers: new Headers() }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/app/${pageB.id}`));

    // A упал, но это не должно отнять колбэк у B.
    expect(successB).toHaveBeenCalledTimes(1);
    expect(successB.mock.calls[0][0]).toBe(pageB);
    expect(successB.mock.calls[0][1]).toMatchObject({ parentId: parentB });
    expect(push).toHaveBeenCalledExactlyOnceWith(`/app/${pageB.id}`);
  });

  it('передаёт в стандартный onSettled undefined, а не подменённый пустой объект', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { create, pending } = mockPendingCreate();
    const { Wrapper } = createWrapper();
    const onSettled = vi.fn<NonNullable<CreatePageMutateOptions['onSettled']>>();

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate(undefined, { onSettled }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    act(() => pending[0].resolve({ status: 201, body: { page }, headers: new Headers() }));

    await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1));
    expect(onSettled.mock.calls[0][2]).toBeUndefined();
  });

  it('передаёт в стандартные onError и onSettled тот же объект переменных по ссылке', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { create, pending } = mockPendingCreate();
    const { Wrapper } = createWrapper();
    const onError = vi.fn<NonNullable<CreatePageMutateOptions['onError']>>();
    const onSettled = vi.fn<NonNullable<CreatePageMutateOptions['onSettled']>>();
    const variables = { title: 'План проекта', parentId: page.id };

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate(variables, { onError, onSettled }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    act(() => pending[0].reject(new Error('create failed')));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe(variables);
    expect(onSettled.mock.calls[0][2]).toBe(variables);
  });

  it('при пустом списке сначала создаёт проект, затем страницу', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const createProject = vi.spyOn(apiClient.projects, 'create').mockResolvedValue({
      status: 201,
      body: { project },
      headers: new Headers(),
    } satisfies CreateProjectResponse);
    const createPage = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper, invalidateQueries, queryClient } = createWrapper();

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(queryClient.getQueryData(projectKeys.all())).toEqual([]));
    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createProject).toHaveBeenCalledWith({ body: { name: 'Мой проект' } });
    expect(createPage).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'Без названия' },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all() });
  });

  it('показывает toast и не переходит при ошибке создания', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies CreatePageResponse);

    const { Wrapper } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useCreatePage(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(await screen.findByText('Недостаточно прав')).toBeInTheDocument();
    expect(screen.getByText('Вы не можете создавать страницы в этом проекте.')).toBeInTheDocument();

    expect(push).not.toHaveBeenCalled();
  });

  it('с явным projectId создаёт страницу в нём, даже если метаданные открытой страницы недоступны и первый проект другой', async () => {
    paramsRef.current = { pageId: page.id };
    vi.spyOn(apiClient.pages, 'get').mockRejectedValue(new TypeError('Network error'));
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page: { ...page, projectId: otherProject.id } },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const createProject = vi.spyOn(apiClient.projects, 'create');
    const { Wrapper, invalidateQueries } = createWrapper();

    const { result } = renderHook(() => useCreatePage(otherProject.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectError).toBe(true));
    act(() => result.current.mutate({ parentId: page.id }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: otherProject.id },
      body: { title: 'Без названия', parentId: page.id },
    });
    expect(createProject).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pageKeys.list(otherProject.id),
    });
    expect(push).toHaveBeenCalledExactlyOnceWith(`/app/${page.id}`);
  });

  it('с явным projectId при пустом списке проектов не создаёт новый проект', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const createProject = vi.spyOn(apiClient.projects, 'create').mockResolvedValue({
      status: 201,
      body: { project },
      headers: new Headers(),
    } satisfies CreateProjectResponse);
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page: { ...page, projectId: otherProject.id } },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(otherProject.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isActiveProjectPending).toBe(false));
    act(() => result.current.mutate({ parentId: page.id }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createProject).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      params: { projectId: otherProject.id },
      body: { title: 'Без названия', parentId: page.id },
    });
    expect(push).toHaveBeenCalledExactlyOnceWith(`/app/${page.id}`);
  });
});

describe('общая операция создания', () => {
  it('блокирует точки входа при ошибке загрузки проектов', async () => {
    vi.spyOn(apiClient.projects, 'list').mockRejectedValue(new TypeError('Network error'));
    const create = vi.spyOn(apiClient.pages, 'create');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CreatePageProvider>
          <CreatePageButton>Создать страницу</CreatePageButton>
          <CreatePageButton>Новая страница</CreatePageButton>
        </CreatePageProvider>
      </QueryClientProvider>,
    );

    const startButton = await screen.findByRole('button', { name: 'Создать страницу' });
    const sidebarButton = screen.getByRole('button', { name: 'Новая страница' });

    await waitFor(() => expect(startButton).toBeDisabled());
    expect(sidebarButton).toBeDisabled();
    startButton.click();
    expect(create).not.toHaveBeenCalled();
  });

  it('блокирует обе точки входа и не отправляет второй запрос', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);

    let resolveCreate: (response: CreatePageResponse) => void = () => undefined;
    const pendingCreate = new Promise<CreatePageResponse>((resolve) => {
      resolveCreate = resolve;
    });
    const create = vi.spyOn(apiClient.pages, 'create').mockReturnValue(pendingCreate);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CreatePageProvider>
          <CreatePageButton>Создать страницу</CreatePageButton>
          <CreatePageButton>Новая страница</CreatePageButton>
        </CreatePageProvider>
      </QueryClientProvider>,
    );

    const startButton = await screen.findByRole('button', { name: 'Создать страницу' });
    const sidebarButton = screen.getByRole('button', { name: 'Новая страница' });

    await waitFor(() => expect(startButton).toBeEnabled());
    startButton.click();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(sidebarButton).toBeDisabled();
    sidebarButton.click();
    expect(create).toHaveBeenCalledTimes(1);

    act(() => {
      resolveCreate({ status: 201, body: { page }, headers: new Headers() });
    });
  });
});
