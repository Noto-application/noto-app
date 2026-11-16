// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { useTrashPages } from './use-trash-pages';

type TrashBody = Extract<
  Awaited<ReturnType<typeof apiClient.pages.trash>>,
  { status: 200 }
>['body'];

const projectId = '00000000-0000-4000-8000-000000000001';
const otherProjectId = '00000000-0000-4000-8000-000000000002';
const item = {
  id: '00000000-0000-4000-8000-000000000003',
  projectId,
  parentId: null,
  title: 'Deleted',
  position: 0,
  deletedAt: '2026-11-01T00:00:00.000Z',
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

afterEach(() => vi.restoreAllMocks());

describe('useTrashPages', () => {
  it('loads all requested portions using the server cursor and stops at null', async () => {
    const second = { ...item, id: '00000000-0000-4000-8000-000000000004' };
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [item], nextCursor: 'opaque' },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [second], nextCursor: null },
        headers: new Headers(),
      });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useTrashPages(projectId), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(trash.mock.calls[0]?.[0]).toMatchObject({ params: { projectId }, query: { limit: 50 } });
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(trash.mock.calls[1]?.[0]).toEqual({
      params: { projectId },
      query: { limit: 50, cursor: 'opaque' },
    });
    expect(result.current.data?.pages.flatMap((portion: TrashBody) => portion.pages)).toEqual([
      item,
      second,
    ]);
  });

  it('treats an empty trash as success', async () => {
    vi.spyOn(apiClient.pages, 'trash').mockResolvedValue({
      status: 200,
      body: { pages: [], nextCursor: null },
      headers: new Headers(),
    });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useTrashPages(projectId), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.pages).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('keeps loaded rows on a next-page failure and retries the same cursor', async () => {
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [item], nextCursor: 'opaque' },
        headers: new Headers(),
      })
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [], nextCursor: null },
        headers: new Headers(),
      });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useTrashPages(projectId), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.data?.pages[0]?.pages).toEqual([item]);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(false));
    expect(trash.mock.calls[2]?.[0]).toEqual(trash.mock.calls[1]?.[0]);
  });

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
  ] as const)('exposes %s and allows an explicit refetch', async (status, code) => {
    vi.spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce({
        status,
        body: { code, message: 'Unavailable' },
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [], nextCursor: null },
        headers: new Headers(),
      });
    const { Wrapper } = setup();
    const { result } = renderHook(() => useTrashPages(projectId), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('separates project data and does not display the previous project while loading', async () => {
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce({
        status: 200,
        body: { pages: [item], nextCursor: null },
        headers: new Headers(),
      })
      .mockImplementationOnce(() => new Promise(() => {}));
    const { Wrapper } = setup();
    const { result, rerender } = renderHook(({ id }) => useTrashPages(id), {
      wrapper: Wrapper,
      initialProps: { id: projectId },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ id: otherProjectId });
    await waitFor(() => expect(trash).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
    expect(trash.mock.calls[1]?.[0]).toMatchObject({ params: { projectId: otherProjectId } });
  });
});
