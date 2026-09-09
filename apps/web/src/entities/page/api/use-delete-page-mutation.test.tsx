// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type * as PagesApi from './pages';
import { deletePage, pageKeys } from './pages';
import { useDeletePageMutation } from './use-delete-page-mutation';

vi.mock('./pages', async (importOriginal) => {
  const actual = await importOriginal<typeof PagesApi>();

  return {
    ...actual,
    deletePage: vi.fn(),
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeletePageMutation', () => {
  it('после успешного удаления удаляет detail query страницы', async () => {
    vi.mocked(deletePage).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();

    const pageId = 'page-42';
    const projectId = 'project-1';

    const detailKey = pageKeys.detail(pageId);

    queryClient.setQueryData(detailKey, {
      id: pageId,
      projectId,
      parentId: null,
      title: 'Обзор',
      content: [],
      position: 0,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    });

    expect(queryClient.getQueryData(detailKey)).toEqual({
      id: pageId,
      projectId,
      parentId: null,
      title: 'Обзор',
      content: [],
      position: 0,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    });

    const { result } = renderHook(() => useDeletePageMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(pageId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryData(detailKey)).toBeUndefined();
  });

  it('после успешного удаления инвалидирует список страниц проекта', async () => {
    vi.mocked(deletePage).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const pageId = 'page-42';
    const projectId = 'project-1';

    queryClient.setQueryData(pageKeys.detail(pageId), {
      id: pageId,
      projectId,
      parentId: null,
      title: 'Обзор',
      content: [],
      position: 0,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    });

    const { result } = renderHook(() => useDeletePageMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(pageId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pageKeys.list(projectId),
    });
  });
});
