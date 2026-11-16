// @vitest-environment jsdom

import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageKeys } from '@/src/entities/page/api/pages';
import { trashKeys } from '@/src/entities/page/api/trash';
import { apiClient } from '@/src/shared/api';

import { useRestorePage } from './use-restore-page';

const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  parentId: null,
  title: 'Restored',
  position: 9,
  content: [],
  currentUserRole: 'editor',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};
const otherProjectId = '00000000-0000-4000-8000-000000000003';
const success = { status: 200 as const, body: { page }, headers: new Headers() };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trashData = {
    pages: [{ pages: [{ id: page.id }], nextCursor: null }],
    pageParams: [undefined],
  };
  client.setQueryData(trashKeys.list(page.projectId), trashData);
  client.setQueryData(pageKeys.list(page.projectId), []);
  client.setQueryData(pageKeys.detail(page.id), null);
  client.setQueryData(trashKeys.list(otherProjectId), trashData);
  client.setQueryData(pageKeys.list(otherProjectId), []);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, trashData, Wrapper };
}

afterEach(() => vi.restoreAllMocks());

describe('useRestorePage', () => {
  it('restores once and marks trash, tree and a cached missing detail for refetch', async () => {
    const restore = vi.spyOn(apiClient.pages, 'restore').mockResolvedValue(success);
    const { client, Wrapper } = setup();
    const { result } = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    await act(async () => {
      expect(await result.current.restore()).toEqual(page);
    });
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith({ params: { pageId: page.id } });
    for (const key of [
      trashKeys.list(page.projectId),
      pageKeys.list(page.projectId),
      pageKeys.detail(page.id),
    ]) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(client.getQueryState(trashKeys.list(otherProjectId))?.isInvalidated).toBe(false);
    expect(client.getQueryState(pageKeys.list(otherProjectId))?.isInvalidated).toBe(false);
  });

  it('suppresses a second invocation before React can render pending state', async () => {
    let finish!: (value: typeof success) => void;
    const restore = vi.spyOn(apiClient.pages, 'restore').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { Wrapper } = setup();
    const { result } = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    let first!: Promise<Page | undefined>;
    let duplicate!: Promise<Page | undefined>;
    act(() => {
      first = result.current.restore();
      duplicate = result.current.restore();
    });
    await expect(duplicate).resolves.toBeUndefined();
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(restore).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(success);
      await first;
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('keeps restore pending when its row is unmounted and opened again', async () => {
    let finish!: (value: typeof success) => void;
    vi.spyOn(apiClient.pages, 'restore').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { Wrapper } = setup();
    const original = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    let pending!: Promise<Page | undefined>;
    act(() => {
      pending = original.result.current.restore();
    });
    await waitFor(() => expect(original.result.current.isPending).toBe(true));
    original.unmount();

    const reopened = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    try {
      await waitFor(() => expect(reopened.result.current.isPending).toBe(true));
    } finally {
      await act(async () => {
        finish(success);
        await pending;
      });
    }
    await waitFor(() => expect(reopened.result.current.isPending).toBe(false));
  });

  it('suppresses a duplicate from a reopened row while its original restore is running', async () => {
    let finish!: (value: typeof success) => void;
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(success);
    const { Wrapper } = setup();
    const original = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    let pending!: Promise<Page | undefined>;
    act(() => {
      pending = original.result.current.restore();
    });
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
    original.unmount();

    const reopened = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    try {
      await act(async () => {
        expect(await reopened.result.current.restore()).toBeUndefined();
      });
      expect(restore).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        finish(success);
        await pending;
      });
    }
  });

  it('allows a reopened row to retry after the original request fails', async () => {
    let fail!: (error: Error) => void;
    const error = new TypeError('Offline');
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      )
      .mockResolvedValue(success);
    const { Wrapper } = setup();
    const original = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    let failure!: Promise<unknown>;
    act(() => {
      failure = original.result.current.restore().catch((reason: unknown) => reason);
    });
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1));
    original.unmount();

    const reopened = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    await act(async () => {
      fail(error);
      expect(await failure).toBe(error);
    });
    await waitFor(() => expect(reopened.result.current.isPending).toBe(false));
    await act(async () => {
      expect(await reopened.result.current.restore()).toEqual(page);
    });
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 403 as const, body: { code: 'FORBIDDEN' as const, message: 'Forbidden' } },
    {
      status: 409 as const,
      body: {
        code: 'CONFLICT' as const,
        message: 'Deleted ancestor',
        details: { blockedBy: { id: otherProjectId, title: 'Root outside loaded rows' } },
      },
    },
    { status: 409 as const, body: { code: 'CONFLICT' as const, message: 'Depth exceeded' } },
  ])('retains data on $status and permits a manual retry', async (failure) => {
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockResolvedValueOnce({ ...failure, headers: new Headers() })
      .mockResolvedValueOnce(success);
    const { client, trashData, Wrapper } = setup();
    const { result } = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.restore()).rejects.toMatchObject({ code: failure.body.code });
    });
    await waitFor(() => expect(result.current.error).toMatchObject({ code: failure.body.code }));
    expect(client.getQueryData(trashKeys.list(page.projectId))).toEqual(trashData);
    expect(client.getQueryState(pageKeys.list(page.projectId))?.isInvalidated).toBe(false);
    expect(restore).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await result.current.restore()).toEqual(page);
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it('does not retry a network failure automatically and releases the guard', async () => {
    const error = new TypeError('Offline');
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(success);
    const { Wrapper } = setup();
    const { result } = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.restore()).rejects.toBe(error);
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(restore).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await result.current.restore()).toEqual(page);
    });
  });

  it('treats 404 as a failure but refreshes stale trash and tree', async () => {
    vi.spyOn(apiClient.pages, 'restore').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Page not found' },
      headers: new Headers(),
    });
    const { client, Wrapper } = setup();
    const { result } = renderHook(() => useRestorePage(page.projectId, page.id), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.restore()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
    expect(client.getQueryState(trashKeys.list(page.projectId))?.isInvalidated).toBe(true);
    expect(client.getQueryState(pageKeys.list(page.projectId))?.isInvalidated).toBe(true);
  });

  it('refreshes the original project when navigation occurs during restore', async () => {
    let finish!: (value: typeof success) => void;
    vi.spyOn(apiClient.pages, 'restore').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { client, Wrapper } = setup();
    const { result, rerender } = renderHook(({ projectId }) => useRestorePage(projectId, page.id), {
      wrapper: Wrapper,
      initialProps: { projectId: page.projectId },
    });
    let pending!: Promise<Page | undefined>;
    act(() => {
      pending = result.current.restore();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    rerender({ projectId: otherProjectId });
    await act(async () => {
      finish(success);
      await pending;
    });
    expect(client.getQueryState(trashKeys.list(page.projectId))?.isInvalidated).toBe(true);
    expect(client.getQueryState(trashKeys.list(otherProjectId))?.isInvalidated).toBe(false);
  });
});
