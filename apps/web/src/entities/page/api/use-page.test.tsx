// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../shared/api';

import { pageKeys } from './pages';
import { usePage } from './use-page';

const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Overview',
  content: [],
  position: 0,
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

describe('usePage', () => {
  it('loads a page and caches it under the detail key', async () => {
    const get = vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 200,
      body: { page },
    } as never);
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage(page.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(page);
    expect(queryClient.getQueryData(pageKeys.detail(page.id))).toEqual(page);
    expect(get).toHaveBeenCalledWith({ params: { pageId: page.id } });
  });

  it('resolves to null for a missing page without a query error', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
    } as never);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage(page.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('exposes API errors as a query error', async () => {
    vi.spyOn(apiClient.pages, 'get').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
    } as never);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage(page.id), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ code: 'FORBIDDEN' });
  });
});
