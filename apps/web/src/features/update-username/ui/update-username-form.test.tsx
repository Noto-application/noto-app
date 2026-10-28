// @vitest-environment jsdom
import type { User } from '@noto/shared/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/src/entities/user';
import { apiClient } from '@/src/shared/api';
import { Toaster } from '@/src/shared/ui/toast';

import { UpdateUsernameForm } from './update-username-form';

type UpdateUserResponse = Awaited<ReturnType<typeof apiClient.users.update>>;
type AuthMeResponse = Awaited<ReturnType<typeof apiClient.auth.me>>;

const currentUser: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dasha@example.com',
  username: 'Dasha',
  createdAt: '2026-10-01T00:00:00.000Z',
};

/** Прогревает кэш профиля — см. ту же причину в `use-update-username.test.tsx`. */
function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(userKeys.current(), currentUser);
  vi.spyOn(apiClient.auth, 'me').mockResolvedValue({
    status: 200,
    body: { user: currentUser },
    headers: new Headers(),
  } satisfies AuthMeResponse);

  return render(
    <QueryClientProvider client={queryClient}>
      <UpdateUsernameForm user={currentUser} />
      <Toaster />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UpdateUsernameForm', () => {
  it('ошибка сохранения не сбрасывает введённый текст', async () => {
    vi.spyOn(apiClient.users, 'update').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies UpdateUserResponse);
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText('Имя');
    await user.clear(input);
    await user.type(input, 'Новое имя');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Не удалось сохранить имя')).toBeInTheDocument();
    expect(input).toHaveValue('Новое имя');
  });

  it('блокирует кнопку «Сохранить» на время запроса — повторный клик не шлёт второй запрос', async () => {
    let resolveUpdate: (response: UpdateUserResponse) => void = () => undefined;
    const pending = new Promise<UpdateUserResponse>((resolve) => {
      resolveUpdate = resolve;
    });
    const update = vi.spyOn(apiClient.users, 'update').mockReturnValue(pending);
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText('Имя');
    await user.clear(input);
    await user.type(input, 'Новое имя');
    const saveButton = screen.getByRole('button', { name: 'Сохранить' });
    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    saveButton.click();

    expect(update).toHaveBeenCalledTimes(1);

    resolveUpdate({ status: 200, body: { user: currentUser }, headers: new Headers() });
    await waitFor(() => expect(saveButton).toBeEnabled());
  });
});
