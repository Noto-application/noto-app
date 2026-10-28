// @vitest-environment jsdom
import type { User } from '@noto/shared/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/src/entities/user';
import { apiClient } from '@/src/shared/api';
import { Toaster } from '@/src/shared/ui/toast';

import { useUpdateUsername } from './use-update-username';

type UpdateUserResponse = Awaited<ReturnType<typeof apiClient.users.update>>;
type AuthMeResponse = Awaited<ReturnType<typeof apiClient.auth.me>>;

const user: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dasha@example.com',
  username: 'Dasha',
  createdAt: '2026-10-01T00:00:00.000Z',
};

/**
 * Прогревает кэш `userKeys.current()` — так же, как к моменту открытия
 * формы его уже прогрел собственный `useCurrentUser()` страницы настроек
 * (issue #125). Хук сам держит активный observer этого ключа, поэтому
 * после успешной инвалидации React Query реально перезапрашивает
 * `apiClient.auth.me` — мокаем и её, иначе уходит в настоящий fetch.
 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(userKeys.current(), user);
  vi.spyOn(apiClient.auth, 'me').mockResolvedValue({
    status: 200,
    body: { user },
    headers: new Headers(),
  } satisfies AuthMeResponse);
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    queryClient,
    invalidateQueries,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUpdateUsername', () => {
  it('сохраняет имя: PATCH своим userId и новым username, инвалидирует профиль, показывает toast', async () => {
    const updatedUser: User = { ...user, username: 'Дарья' };
    const update = vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 200,
      body: { user: updatedUser },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const { Wrapper, invalidateQueries } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate('Дарья'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(update).toHaveBeenCalledExactlyOnceWith({
      params: { userId: user.id },
      body: { username: 'Дарья' },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: userKeys.current() });
    expect(await screen.findByText('Имя сохранено')).toBeInTheDocument();
  });

  it('отправляет запрос, даже если переданное имя совпадает с текущим', async () => {
    const update = vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 200,
      body: { user },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate(user.username as string));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(update).toHaveBeenCalledExactlyOnceWith({
      params: { userId: user.id },
      body: { username: user.username },
    });
  });

  it('400 VALIDATION_ERROR (рассинхрон с клиентской валидацией) — toast с ошибкой', async () => {
    vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const { Wrapper } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate(''));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(await screen.findByText('Не удалось сохранить имя')).toBeInTheDocument();
    expect(screen.getByText('Проверьте соединение и повторите попытку.')).toBeInTheDocument();
  });

  it('403 FORBIDDEN (в норме недостижимо — userId всегда свой) — toast с ошибкой, без спецтекста', async () => {
    vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const { Wrapper } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate('Новое имя'));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(await screen.findByText('Не удалось сохранить имя')).toBeInTheDocument();
  });

  it('401 — ничего не показывает: сессию и редирект уже обработал apiClient', async () => {
    vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const { Wrapper } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate('Новое имя'));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(screen.queryByText('Не удалось сохранить имя')).not.toBeInTheDocument();
  });

  it('сетевая ошибка — тот же общий toast, что и у 400/403', async () => {
    vi.spyOn(apiClient.users, 'update').mockRejectedValue(new TypeError('Network error'));
    const { Wrapper } = createWrapper();

    render(
      <Wrapper>
        <Toaster />
      </Wrapper>,
    );

    const { result } = renderHook(() => useUpdateUsername(), { wrapper: Wrapper });

    act(() => result.current.mutate('Новое имя'));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(await screen.findByText('Не удалось сохранить имя')).toBeInTheDocument();
  });
});
