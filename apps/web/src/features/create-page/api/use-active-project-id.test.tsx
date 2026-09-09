// @vitest-environment jsdom
import type { Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { useActiveProjectId } from './use-active-project-id';

type PageResponse = Awaited<ReturnType<typeof apiClient.pages.get>>;
type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;

const { paramsRef } = vi.hoisted(() => {
  const ref: { current: { pageId?: string } } = { current: {} };
  return { paramsRef: ref };
});

vi.mock('next/navigation', () => ({
  useParams: () => paramsRef.current,
}));

const project: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Мой проект',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

const page: Page = {
  id: '00000000-0000-4000-8000-000000000002',
  projectId: '00000000-0000-4000-8000-000000000003',
  parentId: null,
  title: 'Overview',
  content: [],
  position: 0,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
}

beforeEach(() => {
  paramsRef.current = {};
  vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
    status: 200,
    body: { projects: [] },
    headers: new Headers(),
  } satisfies ProjectsResponse);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useActiveProjectId', () => {
  it('берёт projectId из открытой страницы, если pageId есть в URL', async () => {
    paramsRef.current = { pageId: page.id };
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page },
      headers: new Headers(),
    } satisfies PageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveProjectId(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.projectId).toBe(page.projectId);
    expect(result.current.isError).toBe(false);
  });

  it('без pageId в URL берёт первый загруженный проект', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveProjectId(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.projectId).toBe(project.id);
  });

  it('без pageId и с ещё не загруженными проектами остаётся в isPending, не зависая из-за отключённого usePage', () => {
    let resolveList: (response: ProjectsResponse) => void = () => undefined;
    vi.spyOn(apiClient.projects, 'list').mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveProjectId(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.isError).toBe(false);

    resolveList({ status: 200, body: { projects: [] }, headers: new Headers() });
  });

  it('если открытая страница не найдена (usePage вернул null), не считает это ошибкой', async () => {
    paramsRef.current = { pageId: page.id };
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies PageResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveProjectId(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.projectId).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('без pageId пробрасывает ошибку загрузки проектов', async () => {
    vi.spyOn(apiClient.projects, 'list').mockRejectedValue(new TypeError('Network error'));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveProjectId(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.projectId).toBeUndefined();
  });
});
