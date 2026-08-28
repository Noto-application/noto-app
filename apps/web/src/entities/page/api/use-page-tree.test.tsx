// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { pageKeys } from './pages';
import { usePageTree } from './use-page-tree';

type PagesListResponse = Awaited<ReturnType<typeof apiClient.pages.list>>;

const rootPage: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Overview',
  content: [],
  position: 0,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const childPage: Page = {
  ...rootPage,
  id: '00000000-0000-4000-8000-000000000003',
  parentId: rootPage.id,
  title: 'Child page',
  position: 1,
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    queryClient,
    Wrapper,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageTree', () => {
  it('selects a page tree without replacing the cached page list', async () => {
    const pages = [childPage, rootPage];
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages },
      headers: new Headers(),
    } satisfies PagesListResponse);
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => usePageTree(rootPage.projectId), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject([
      {
        id: rootPage.id,
        parentId: null,
        position: 0,
        title: 'Overview',
        children: [
          {
            id: childPage.id,
            parentId: rootPage.id,
            position: 1,
            title: 'Child page',
            children: [],
          },
        ],
      },
    ]);
    expect(queryClient.getQueryData(pageKeys.list(rootPage.projectId))).toEqual(pages);
  });

  it('exposes an invalid hierarchy as a query error', async () => {
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages: [{ ...childPage, parentId: 'missing' }] },
      headers: new Headers(),
    } satisfies PagesListResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePageTree(rootPage.projectId), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ message: 'Parent page not found: missing' });
  });
});
