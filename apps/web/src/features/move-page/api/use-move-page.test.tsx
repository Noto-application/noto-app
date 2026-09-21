// @vitest-environment jsdom

import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { pageKeys, updatePage } from '@/src/entities/page';

import { useMovePage } from './use-move-page';

vi.mock('@/src/entities/page', () => ({
  pageKeys: {
    list: (projectId: string) => ['pages', 'list', projectId] as const,
  },
  updatePage: vi.fn(),
}));

const movedPage: Page = {
  id: 'page-1',
  projectId: 'project-1',
  parentId: 'parent-1',
  title: 'План',
  content: [],
  position: 1,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMovePage', () => {
  it('перемещает страницу и инвалидирует список проекта', async () => {
    vi.mocked(updatePage).mockResolvedValue(movedPage);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMovePage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        pageId: movedPage.id,
        projectId: movedPage.projectId,
        parentId: movedPage.parentId,
        position: movedPage.position,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updatePage).toHaveBeenCalledWith('page-1', {
      parentId: 'parent-1',
      position: 1,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: pageKeys.list('project-1'),
    });
  });
});
