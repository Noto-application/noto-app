// @vitest-environment jsdom
import type { Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageKeys } from '@/src/entities/page/api/pages';
import { projectKeys } from '@/src/entities/project/api/projects';
import { apiClient } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';

import { CreatePageProvider } from '../model/create-page-context';
import { CreatePageButton } from '../ui/create-page-button';
import { useCreatePage } from './use-create-page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;
type CreateProjectResponse = Awaited<ReturnType<typeof apiClient.projects.create>>;
type CreatePageResponse = Awaited<ReturnType<typeof apiClient.pages.create>>;

const project: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Мой проект',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
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
});

describe('useCreatePage', () => {
  it('создаёт страницу с названием по умолчанию, инвалидирует список и переходит к ней', async () => {
    const create = vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 201,
      body: { page },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const { Wrapper, invalidateQueries } = createWrapper();

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(create).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'Без названия' },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pageKeys.list(project.id) });
    expect(push).toHaveBeenCalledWith(`/app/${page.id}`);
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
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(createProject).toHaveBeenCalledWith({ body: { name: 'Мой проект' } });
    expect(createPage).toHaveBeenCalledWith({
      params: { projectId: project.id },
      body: { title: 'Без названия' },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: projectKeys.all() });
  });

  it('показывает toast и не переходит при ошибке создания', async () => {
    vi.spyOn(apiClient.pages, 'create').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies CreatePageResponse);
    const error = vi.spyOn(toast, 'error');
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreatePage(project.id), { wrapper: Wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(error).toHaveBeenCalledWith(
      'Недостаточно прав',
      'Вы не можете создавать страницы в этом проекте.',
    );
    expect(push).not.toHaveBeenCalled();
  });
});

describe('общая операция создания', () => {
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
