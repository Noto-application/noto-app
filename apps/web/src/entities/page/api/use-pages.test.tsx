// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { pageKeys } from './pages';
import { usePagesList } from './use-pages';

type PagesListResponse = Awaited<ReturnType<typeof apiClient.pages.list>>;

const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Overview',
  content: [],
  position: 0,
  currentUserRole: 'owner',
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
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

describe('usePagesList', () => {
  it('loads pages and caches them under the list key', async () => {
    const list = vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages: [page] },
      headers: new Headers(),
    } satisfies PagesListResponse);
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => usePagesList(page.projectId), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([page]);
    expect(queryClient.getQueryData(pageKeys.list(page.projectId))).toEqual([page]);
    expect(list).toHaveBeenCalledWith({ params: { projectId: page.projectId } });
  });

  it('resolves to an empty list for a project without pages', async () => {
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 200,
      body: { pages: [] },
      headers: new Headers(),
    } satisfies PagesListResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePagesList(page.projectId), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('exposes API errors as a query error', async () => {
    vi.spyOn(apiClient.pages, 'list').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies PagesListResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePagesList(page.projectId), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ code: 'FORBIDDEN' });
  });
});
