// @vitest-environment jsdom
import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';
import { pageKeys } from '@/src/entities/page';

import { AUTOSAVE_DEBOUNCE_MS } from './use-page-autosave';
import { usePageTitleAutosave } from './use-page-title-autosave';

type UpdateResponse = Awaited<ReturnType<typeof apiClient.pages.update>>;

const pageId = '00000000-0000-4000-8000-000000000001';
const projectId = '00000000-0000-4000-8000-000000000002';

function updatedResponse(title: Page['title']) {
  return {
    status: 200,
    body: {
      page: {
        id: pageId,
        projectId,
        parentId: null,
        title,
        content: [],
        position: 0,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z',
      },
    },
    headers: new Headers(),
  } satisfies UpdateResponse;
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...renderHook(() => usePageTitleAutosave(pageId, projectId), { wrapper: Wrapper }), queryClient };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePageTitleAutosave', () => {
  it('объединяет частые изменения в один PATCH после паузы', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse(''));
    const { result } = setup();

    result.current.onChange('N');
    result.current.onChange('No');
    result.current.onChange('Noto');

    expect(update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ params: { pageId }, body: { title: 'Noto' } });
  });

  it('сохраняет отложенное изменение сразу при размонтировании', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse(''));
    const { result, unmount } = setup();

    result.current.onChange('Не досохранённое название');
    unmount();
    await vi.advanceTimersByTimeAsync(0);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      params: { pageId },
      body: { title: 'Не досохранённое название' },
    });
  });

  it('не шлёт запрос при размонтировании без изменений', () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse(''));
    const { unmount } = setup();

    unmount();

    expect(update).not.toHaveBeenCalled();
  });

  it('не отправляет пустой (или из одних пробелов) заголовок', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse(''));
    const { result } = setup();

    result.current.onChange('   ');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(update).not.toHaveBeenCalled();
  });

  it('триммит заголовок перед отправкой', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse('Noto'));
    const { result } = setup();

    result.current.onChange('  Noto  ');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(update).toHaveBeenCalledWith({ params: { pageId }, body: { title: 'Noto' } });
  });

  it('очистка заголовка отменяет уже запланированную отправку предыдущего значения', async () => {
    const update = vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse(''));
    const { result, unmount } = setup();

    result.current.onChange('Noto');
    result.current.onChange('   ');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(update).not.toHaveBeenCalled();

    unmount();
    await vi.advanceTimersByTimeAsync(0);

    expect(update).not.toHaveBeenCalled();
  });

  it('после успешного сохранения инвалидирует список страниц проекта (сайдбар)', async () => {
    vi.spyOn(apiClient.pages, 'update').mockResolvedValue(updatedResponse('Noto'));
    const { result, queryClient } = setup();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.onChange('Noto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pageKeys.list(projectId) });
  });

  it('после успешного сохранения кладёт сохранённую страницу в detail-кэш', async () => {
    const response = updatedResponse('Noto');
    vi.spyOn(apiClient.pages, 'update').mockResolvedValue(response);
    const { result, queryClient } = setup();

    result.current.onChange('Noto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(queryClient.getQueryData(pageKeys.detail(pageId))).toEqual(response.body.page);
  });

  it('мержит title в detail-кэш, не откатывая content, сохранённый параллельно usePageAutosave', async () => {
    const response = updatedResponse('Noto');
    vi.spyOn(apiClient.pages, 'update').mockResolvedValue(response);
    const { result, queryClient } = setup();
    // Снимок ответа этой мутации ещё не знает о новом content — он сделан
    // на сервере до того, как content-PATCH успел закоммититься. Если бы мы
    // писали в кэш весь объект целиком, этот снимок откатил бы content.
    const parallelContent = [{ type: 'paragraph', content: 'сохранено параллельно' }];
    queryClient.setQueryData(pageKeys.detail(pageId), { ...response.body.page, content: parallelContent });

    result.current.onChange('Noto');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(queryClient.getQueryData(pageKeys.detail(pageId))).toMatchObject({
      title: 'Noto',
      content: parallelContent,
    });
  });
});
