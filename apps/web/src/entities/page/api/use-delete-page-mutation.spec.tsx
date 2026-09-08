// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { deletePage, pageKeys } from './pages';
import { useDeletePageMutation } from './use-delete-page-mutation';

vi.mock('./pages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pages')>();

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
    const detailKey = pageKeys.detail(pageId);

    queryClient.setQueryData(detailKey, {
      id: pageId,
      title: 'Обзор',
    });

    expect(queryClient.getQueryData(detailKey)).toEqual({
      id: pageId,
      title: 'Обзор',
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

  it('после успешного удаления инвалидирует список страниц', async () => {
    vi.mocked(deletePage).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeletePageMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('page-42');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['pages', 'list'],
    });
  });
});
