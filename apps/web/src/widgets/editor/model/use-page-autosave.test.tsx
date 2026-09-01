// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { AUTOSAVE_DEBOUNCE_MS, usePageAutosave } from './use-page-autosave';

type UpdateResponse = Awaited<ReturnType<typeof apiClient.pages.update>>;

const pageId = '00000000-0000-4000-8000-000000000001';

function updatedResponse(content: Page['content']): UpdateResponse {
  return {
    status: 200,
    body: {
      page: {
        id: pageId,
        projectId: '00000000-0000-4000-8000-000000000002',
        parentId: null,
        title: 'Overview',
        content,
        position: 0,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      },
    },
    headers: new Headers(),
  } satisfies UpdateResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => usePageAutosave(pageId), { wrapper: Wrapper });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePageAutosave', () => {
  it('объединяет частые изменения в один PATCH после паузы', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse([]));
    const { result } = setup();

    result.current.onChange([{ type: 'paragraph', content: 'a' }]);
    result.current.onChange([{ type: 'paragraph', content: 'ab' }]);
    result.current.onChange([{ type: 'paragraph', content: 'abc' }]);

    expect(update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      params: { pageId },
      body: { content: [{ type: 'paragraph', content: 'abc' }] },
    });
  });

  it('сохраняет отложенное изменение сразу при размонтировании', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse([]));
    const { result, unmount } = setup();

    result.current.onChange([{ type: 'paragraph', content: 'не досохранённый текст' }]);
    unmount();
    await vi.advanceTimersByTimeAsync(0);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      params: { pageId },
      body: { content: [{ type: 'paragraph', content: 'не досохранённый текст' }] },
    });
  });

  it('не шлёт запрос при размонтировании без изменений', () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse([]));
    const { unmount } = setup();

    unmount();

    expect(update).not.toHaveBeenCalled();
  });

  it('при ошибке сохранения пишет в консоль, а не молчит и не роняет приложение', async () => {
    const requestError = new Error('Network request failed');
    vi.spyOn(apiClient.pages, 'update').mockRejectedValue(requestError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup();

    result.current.onChange([{ type: 'paragraph', content: 'правка перед обрывом сети' }]);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]?.[1]).toBe(requestError);
  });

  it('status идёт idle → saving → saved по мере сохранения', async () => {
    const { promise, resolve } = deferred<UpdateResponse>();
    vi.spyOn(apiClient.pages, 'update').mockReturnValue(promise);
    const { result, rerender } = setup();

    expect(result.current.status).toBe('idle');

    result.current.onChange([{ type: 'paragraph', content: 'a' }]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS));
    // react-query уведомляет о новом статусе мутации через свой internal
    // notifyManager, а не напрямую — в jsdom под fake timers React из-за
    // этого не перерисовывается сам, `rerender()` подтягивает актуальный
    // статус из того же (уже обновившегося) mutation observer.
    rerender();

    expect(result.current.status).toBe('saving');

    resolve(updatedResponse([{ type: 'paragraph', content: 'a' }]));
    await act(() => vi.advanceTimersByTimeAsync(0));
    rerender();

    expect(result.current.status).toBe('saved');
  });

  it('retry после ошибки повторно отправляет тот же контент и переводит status в saved', async () => {
    const update = vi
      .spyOn(apiClient.pages, 'update')
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(updatedResponse([{ type: 'paragraph', content: 'a' }]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, rerender } = setup();

    result.current.onChange([{ type: 'paragraph', content: 'a' }]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS));
    rerender();
    expect(result.current.status).toBe('error');

    act(() => result.current.retry());
    await act(() => vi.advanceTimersByTimeAsync(0));
    rerender();

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(2, {
      params: { pageId },
      body: { content: [{ type: 'paragraph', content: 'a' }] },
    });
    expect(result.current.status).toBe('saved');
  });

  it('retry ничего не отправляет, если сохранять нечего', () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse([]));
    const { result } = setup();

    result.current.retry();

    expect(update).not.toHaveBeenCalled();
  });
});
