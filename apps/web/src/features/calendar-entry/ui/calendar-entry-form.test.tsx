// @vitest-environment jsdom
import type { CalendarEntry, CalendarPageResponse, Page, Project } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calendarEntryKeys } from '@/src/entities/calendar-entry';
import { pageKeys } from '@/src/entities/page';
import { projectKeys } from '@/src/entities/project/api/projects';
import { apiClient } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';

import { CalendarEntryForm } from './calendar-entry-form';

// Публичная поверхность для TEST-review: один feature, projectId + initialDate,
// опциональный pageId для PUT, onClose; форма смонтирована только пока открыта.
// Accessible labels ниже — предлагаемый UX-контракт, не выбор библиотеки диалога.
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }) }));

const projectId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const date = '2026-11-01';
const project: Project = {
  id: projectId,
  name: 'Project',
  currentUserRole: 'editor',
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
};
const page: Page = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId,
  parentId: null,
  title: 'Scheduled',
  content: [],
  position: 0,
  currentUserRole: 'viewer',
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
};
const entry: CalendarEntry = {
  pageId: page.id,
  projectId,
  title: page.title,
  date,
  updatedAt: page.updatedAt,
};
const reply = <S extends number, B>(status: S, body: B) => ({
  status,
  body,
  headers: new Headers(),
});
const success = (value: CalendarEntry | null = entry) =>
  reply(200, { page, entry: value } satisfies CalendarPageResponse);
const failure = (status: number) =>
  reply(status, {
    code:
      (
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
        } as Record<number, string>
      )[status] ?? 'INTERNAL',
    message: 'Request failed',
  });
const clients: QueryClient[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup(pageId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  client.setQueryData(projectKeys.detail(projectId), project);
  client.setQueryData(projectKeys.detail(otherId), { ...project, id: otherId });
  const onClose = vi.fn();
  const wrapper = (children: ReactNode) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const form = (id = projectId) =>
    wrapper(
      <CalendarEntryForm projectId={id} initialDate={date} pageId={pageId} onClose={onClose} />,
    );
  const view = render(form());
  return {
    ...view,
    client,
    onClose,
    switchProject: () => view.rerender(form(otherId)),
    close: () => view.rerender(wrapper(null)),
    reopen: () => view.rerender(form()),
  };
}

// Один проход очереди задач внутри act даёт завершиться async validation и
// уведомлениям Query; затем проверяем фактическое завершение запросов/мутаций.
async function settle(client: QueryClient, pendingMutation = false) {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => {
    expect(client.isFetching()).toBe(0);
    if (!pendingMutation) expect(client.isMutating()).toBe(0);
  });
}

function currentForm() {
  const form = screen.getByLabelText('Заголовок').closest('form');
  expect(form).toBeInstanceOf(HTMLFormElement);
  if (!form) throw new Error('Expected the rendered calendar form');
  return form;
}

async function submitForm(form: HTMLFormElement, client: QueryClient, pendingMutation = false) {
  await act(async () => {
    // Submit напрямую проверяет guard обработчика, а не только disabled-кнопку.
    fireEvent.submit(form);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await settle(client, pendingMutation);
}

async function assertBlockedSubmit(
  form: HTMLFormElement,
  client: QueryClient,
  name: RegExp,
  pendingMutation = false,
) {
  await settle(client, pendingMutation);
  const button = screen.queryByRole('button', { name });
  if (button) expect(button).toBeDisabled();
  else expect(button).not.toBeInTheDocument();
  if (form.isConnected) await submitForm(form, client, pendingMutation);
  else {
    expect(form).not.toBeInTheDocument();
    expect(button).not.toBeInTheDocument();
    await settle(client, pendingMutation);
  }
}

async function createDraft(title = '  Scheduled  ') {
  const input = await screen.findByLabelText('Заголовок');
  fireEvent.change(input, { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
}
const retry = () => fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

beforeEach(() => {
  navigation.push.mockReset();
  vi.spyOn(toast, 'success').mockReturnValue('test-toast');
  vi.spyOn(toast, 'error').mockReturnValue('test-toast-error');
  vi.spyOn(apiClient.projects, 'get').mockImplementation(({ params }) =>
    Promise.resolve({
      status: 200,
      body: { project: { ...project, id: params.projectId } },
      headers: new Headers(),
    }),
  );
  vi.spyOn(apiClient.calendar, 'get').mockResolvedValue(reply(200, { entry: null }));
  vi.spyOn(apiClient.pages, 'get').mockResolvedValue(reply(200, { page }));
  vi.spyOn(apiClient.calendar, 'create').mockResolvedValue(success());
  vi.spyOn(apiClient.calendar, 'update').mockResolvedValue(reply(200, { entry }));
  vi.spyOn(apiClient.pages, 'update').mockRejectedValue(new Error('Unexpected Page write'));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe('CalendarEntryForm create (#136)', () => {
  it('normalizes title, keeps the clicked date-only day, and blocks duplicate pending submissions', async () => {
    const pending = deferred<Awaited<ReturnType<typeof apiClient.calendar.create>>>();
    vi.mocked(apiClient.calendar.create).mockReturnValue(pending.promise);
    const view = setup();
    expect(await screen.findByLabelText('Дата')).toHaveValue(date);
    await settle(view.client);
    const form = currentForm();
    await createDraft();
    await waitFor(() => expect(apiClient.calendar.create).toHaveBeenCalledTimes(1));
    const sent = vi.mocked(apiClient.calendar.create).mock.calls[0][0];
    expect(sent).toMatchObject({
      params: { projectId },
      body: { title: 'Scheduled', date },
    });
    expect(sent.body.clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(screen.getByLabelText('Заголовок')).toBeDisabled();
    expect(screen.getByLabelText('Дата')).toBeDisabled();
    const submit = screen.getByRole('button', { name: /созда/i });
    expect(submit).toBeDisabled();
    await submitForm(form, view.client, true);
    expect(apiClient.calendar.create).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(success());
      await pending.promise;
    });
  });

  it.each(['   ', 'x'.repeat(201)])('does not send an invalid title', async (title) => {
    setup();
    await createDraft(title);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(apiClient.calendar.create).not.toHaveBeenCalled();
  });

  it.each([
    ['network', undefined],
    ['timeout', undefined],
    ['malformed 500', reply(500, { bad: true })],
    ['unknown status', reply(0, { code: 'VALIDATION_ERROR', message: 'Status lost' })],
    ['malformed 201', reply(201, { page, entry: null })],
    ['malformed replay', reply(200, { entry: null })],
  ])(
    'freezes the original payload after %s and resolves only verified replay null',
    async (kind, response) => {
      const create = vi.mocked(apiClient.calendar.create);
      if (response) create.mockResolvedValueOnce(response as never);
      else
        create.mockRejectedValueOnce(
          kind === 'timeout'
            ? new DOMException('Timed out', 'TimeoutError')
            : new TypeError('Network error'),
        );
      create.mockResolvedValue(success(null));
      const view = setup();
      await createDraft();
      expect(await screen.findByRole('button', { name: 'Повторить' })).toBeEnabled();
      const original = structuredClone(create.mock.calls[0][0]);
      expect(screen.getByLabelText('Заголовок')).toBeDisabled();
      expect(screen.getByLabelText('Дата')).toBeDisabled();
      retry();
      await waitFor(() => expect(view.onClose).toHaveBeenCalledTimes(1));
      expect(create.mock.calls.map(([request]) => request)).toEqual([original, original]);
      expect(apiClient.calendar.update).not.toHaveBeenCalled();
    },
  );

  it.each([400, 401, 403, 404, 409])(
    'does not unfreeze an uncertain intent after later %s',
    async (status) => {
      const create = vi
        .mocked(apiClient.calendar.create)
        .mockRejectedValueOnce(new TypeError('Lost response'))
        .mockResolvedValueOnce(failure(status) as never);
      const view = setup();
      await createDraft();
      await screen.findByRole('button', { name: 'Повторить' });
      retry();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      await screen.findByText('Request failed');
      expect(screen.getByLabelText('Заголовок')).toBeDisabled();
      expect(screen.getByLabelText('Дата')).toBeDisabled();
      expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
      expect(view.onClose).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(2);
    },
  );

  it('allows explicit correction after a first known 400 without automatically sending a new intent', async () => {
    const create = vi
      .mocked(apiClient.calendar.create)
      .mockResolvedValueOnce(failure(400) as never);
    const view = setup();
    await createDraft();
    await screen.findByRole('alert');
    await settle(view.client);
    const original = create.mock.calls[0][0];
    expect(screen.getByLabelText('Заголовок')).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Corrected' } });
    await settle(view.client);
    expect(create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1][0].body.title).toBe('Corrected');
    expect(create.mock.calls[1][0].body.clientRequestId).not.toBe(original.body.clientRequestId);
  });

  it('keeps a first fingerprint conflict visible without automatically changing key or applying PUT logic', async () => {
    const create = vi
      .mocked(apiClient.calendar.create)
      .mockResolvedValueOnce(failure(409) as never);
    const view = setup();
    await createDraft();
    await screen.findByRole('alert');
    await settle(view.client);
    expect(screen.getByLabelText('Заголовок')).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(apiClient.calendar.get).not.toHaveBeenCalled();
    expect(apiClient.calendar.update).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])(
    'shows a first known %s and never sends another create after the role becomes unknown',
    async (status) => {
      const create = vi
        .mocked(apiClient.calendar.create)
        .mockResolvedValueOnce(failure(status) as never);
      const view = setup();
      await settle(view.client);
      await createDraft();
      await screen.findByText('Request failed');
      await settle(view.client);
      const form = currentForm();
      act(() => {
        view.client.setQueryData(projectKeys.detail(projectId), {
          ...project,
          currentUserRole: undefined,
        });
      });
      await assertBlockedSubmit(form, view.client, /создать|повторить/i);
      expect(create).toHaveBeenCalledTimes(1);
      expect(view.onClose).not.toHaveBeenCalled();
    },
  );

  it.each(['viewer', undefined])(
    'blocks retry when the Project role becomes %s without discarding uncertainty',
    async (role) => {
      const create = vi
        .mocked(apiClient.calendar.create)
        .mockRejectedValueOnce(new TypeError('Lost response'));
      const view = setup();
      await settle(view.client);
      await createDraft();
      await screen.findByRole('button', { name: 'Повторить' });
      await settle(view.client);
      const form = currentForm();
      act(() => {
        view.client.setQueryData(projectKeys.detail(projectId), {
          ...project,
          currentUserRole: role,
        });
      });
      await assertBlockedSubmit(form, view.client, /повторить/i);
      expect(create).toHaveBeenCalledTimes(1);
      act(() => {
        view.client.setQueryData(projectKeys.detail(projectId), project);
      });
      await settle(view.client);
      expect(await screen.findByLabelText('Заголовок')).toBeDisabled();
    },
  );

  it.each(['pending', 'uncertain'])(
    'warns on user cancel while %s, then allows a genuinely new form intent',
    async (state) => {
      const pending = deferred<Awaited<ReturnType<typeof apiClient.calendar.create>>>();
      const create = vi.mocked(apiClient.calendar.create).mockReturnValueOnce(pending.promise);
      const view = setup();
      await createDraft();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
      const original = structuredClone(create.mock.calls[0][0]);
      if (state === 'uncertain') {
        await act(async () => {
          pending.reject(new TypeError('Lost response'));
          await pending.promise.catch(() => {});
        });
        await screen.findByRole('button', { name: 'Повторить' });
      }
      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
      expect(
        await screen.findByText(/результат неизвестен.*проверьте созданные страницы/i),
      ).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Закрыть форму' }));
      await waitFor(() => expect(view.onClose).toHaveBeenCalledTimes(1));
      view.close();
      view.reopen();
      expect(await screen.findByLabelText('Заголовок')).toHaveValue('');
      if (state === 'pending') {
        await act(async () => {
          pending.resolve(success());
          await pending.promise;
        });
        expect(view.onClose).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('Заголовок')).toHaveValue('');
        expect(navigation.push).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(screen.queryByText(/успешно|страница создана/i)).not.toBeInTheDocument();
      }
      await createDraft();
      await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
      expect(create.mock.calls[1][0].body.clientRequestId).not.toBe(original.body.clientRequestId);
    },
  );

  it('on project switch warns, refuses stale retry and lets only captured caches receive a late response', async () => {
    const pending = deferred<Awaited<ReturnType<typeof apiClient.calendar.create>>>();
    const create = vi.mocked(apiClient.calendar.create).mockReturnValueOnce(pending.promise);
    const view = setup();
    await settle(view.client);
    await screen.findByLabelText('Заголовок');
    const form = currentForm();
    const oldKeys = [
      calendarEntryKeys.range(projectId, '2026-10-26', '2026-12-07'),
      ['calendar-entry', projectId, 'page', page.id],
      pageKeys.list(projectId),
    ];
    const otherKey = calendarEntryKeys.range(otherId, '2026-10-26', '2026-12-07');
    for (const key of [...oldKeys, otherKey]) view.client.setQueryData(key, []);
    await createDraft();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    view.switchProject();
    expect(
      await screen.findByText(/результат неизвестен.*проверьте созданные страницы/i),
    ).toBeVisible();
    await assertBlockedSubmit(form, view.client, /создать|повторить/i, true);
    expect(create).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть форму' }));
    view.close();
    view.reopen();
    await act(async () => {
      pending.resolve(success());
      await pending.promise;
    });
    await waitFor(() => {
      for (const key of oldKeys) expect(view.client.getQueryState(key)?.isInvalidated).toBe(true);
    });
    expect(view.client.getQueryState(otherKey)?.isInvalidated).toBe(false);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(view.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Заголовок')).toHaveValue('');
  });

  it('invalidates all source-project read forms and Page caches, never another project', async () => {
    const view = setup();
    const keys = [
      calendarEntryKeys.range(projectId, '2026-10-26', '2026-12-07'),
      calendarEntryKeys.range(projectId, '2026-11-30', '2027-01-11'),
      ['calendar-entry', projectId, 'page', page.id],
      pageKeys.list(projectId),
    ];
    const other = ['calendar-entry', otherId, 'page', page.id];
    for (const key of [...keys, other]) view.client.setQueryData(key, []);
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');
    await createDraft();
    await waitFor(() => expect(view.onClose).toHaveBeenCalledTimes(1));
    for (const key of keys) expect(view.client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(view.client.getQueryState(other)?.isInvalidated).toBe(false);
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: pageKeys.detail(page.id) }),
    );
  });

  it('does not retry a committed POST when cache invalidation fails', async () => {
    const view = setup();
    await screen.findByLabelText('Заголовок');
    await settle(view.client);
    const form = currentForm();
    vi.spyOn(view.client, 'invalidateQueries').mockRejectedValue(new Error('Cache refresh failed'));
    await createDraft();
    await waitFor(() => expect(apiClient.calendar.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.onClose).toHaveBeenCalledTimes(1));
    // Как реальный родитель: onClose удаляет завершённую форму, retry create
    // больше недоступен; ждём и обработку отклонённой инвалидации.
    view.close();
    expect(form).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
    await settle(view.client);
    expect(apiClient.calendar.create).toHaveBeenCalledTimes(1);
  });
});

describe('CalendarEntryForm PUT (#136)', () => {
  it.each([null, '2026-12-25'])(
    'uses the successful point snapshot %s, not an empty range, without changing hierarchy',
    async (currentDate) => {
      vi.mocked(apiClient.calendar.get).mockResolvedValue(
        reply(200, { entry: currentDate ? { ...entry, date: currentDate } : null }),
      );
      const nested = { ...page, parentId: otherId };
      vi.mocked(apiClient.pages.get).mockResolvedValue(reply(200, { page: nested }));
      const view = setup(page.id);
      view.client.setQueryData(pageKeys.detail(page.id), nested);
      view.client.setQueryData(calendarEntryKeys.range(projectId, '2026-10-26', '2026-12-07'), []);
      expect(await screen.findByLabelText('Дата')).toBeEnabled();
      fireEvent.change(screen.getByLabelText('Дата'), { target: { value: date } });
      save();
      await waitFor(() =>
        expect(apiClient.calendar.update).toHaveBeenCalledWith({
          params: { projectId, pageId: page.id },
          body: { date, expectedDate: currentDate },
        }),
      );
      expect(apiClient.pages.update).not.toHaveBeenCalled();
      expect(view.client.getQueryData(pageKeys.detail(page.id))).toMatchObject({
        parentId: otherId,
      });
    },
  );

  it('retries an unknown PUT with the exact captured desired state and expected date', async () => {
    vi.mocked(apiClient.calendar.get).mockResolvedValue(
      reply(200, { entry: { ...entry, date: '2026-12-25' } }),
    );
    const update = vi
      .mocked(apiClient.calendar.update)
      .mockRejectedValueOnce(new TypeError('Lost response'));
    const view = setup(page.id);
    fireEvent.change(await screen.findByLabelText('Дата'), { target: { value: date } });
    save();
    await screen.findByRole('button', { name: 'Повторить' });
    await settle(view.client);
    expect(update.mock.calls[0][0]).toEqual({
      params: { projectId, pageId: page.id },
      body: { date, expectedDate: '2026-12-25' },
    });
    const freshEntry = { ...entry, date: '2027-01-15' };
    vi.mocked(apiClient.calendar.get).mockResolvedValue(reply(200, { entry: freshEntry }));
    act(() => {
      view.client.setQueryData(['calendar-entry', projectId, 'page', page.id], freshEntry);
    });
    await settle(view.client);
    expect(view.client.getQueryData(['calendar-entry', projectId, 'page', page.id])).toEqual(
      freshEntry,
    );
    retry();
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await settle(view.client);
    expect(update.mock.calls[1][0]).toEqual(update.mock.calls[0][0]);
  });

  it.each([date, null])(
    'after CAS refetch already at target %s does not send a second PUT',
    async (target) => {
      const get = vi
        .mocked(apiClient.calendar.get)
        .mockResolvedValueOnce(reply(200, { entry: { ...entry, date: '2026-12-25' } }))
        .mockResolvedValue(reply(200, { entry: target ? { ...entry, date: target } : null }));
      vi.mocked(apiClient.calendar.update).mockResolvedValueOnce(failure(409) as never);
      const view = setup(page.id);
      await screen.findByLabelText('Дата');
      if (target) {
        fireEvent.change(screen.getByLabelText('Дата'), { target: { value: target } });
        save();
      } else fireEvent.click(screen.getByRole('button', { name: 'Снять дату' }));
      await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
      await waitFor(() =>
        expect(view.client.getQueryData(['calendar-entry', projectId, 'page', page.id])).toEqual(
          target ? { ...entry, date: target } : null,
        ),
      );
      await settle(view.client);
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Подтвердить изменение' }),
        ).not.toBeInTheDocument(),
      );
      expect(apiClient.calendar.update).toHaveBeenCalledTimes(1);
      expect(apiClient.calendar.update).toHaveBeenCalledWith({
        params: { projectId, pageId: page.id },
        body: { date: target, expectedDate: '2026-12-25' },
      });
      expect(apiClient.pages.update).not.toHaveBeenCalled();
      expect(screen.queryByText(/вы изменили|ваше изменение сохранено/i)).not.toBeInTheDocument();
    },
  );

  it.each([date, null])(
    'invalidates ranges and refetches the active point after PUT to %s, without touching another project',
    async (target) => {
      vi.mocked(apiClient.calendar.get)
        .mockResolvedValueOnce(reply(200, { entry: { ...entry, date: '2026-12-25' } }))
        .mockResolvedValue(reply(200, { entry: target ? { ...entry, date: target } : null }));
      vi.mocked(apiClient.calendar.update).mockResolvedValue(
        reply(200, { entry: target ? { ...entry, date: target } : null }),
      );
      const view = setup(page.id);
      const ranges = [
        calendarEntryKeys.range(projectId, '2026-10-26', '2026-12-07'),
        calendarEntryKeys.range(projectId, '2026-11-30', '2027-01-11'),
      ];
      const other = ['calendar-entry', otherId, 'page', page.id];
      for (const key of [...ranges, other, pageKeys.list(projectId)])
        view.client.setQueryData(key, []);
      const invalidate = vi.spyOn(view.client, 'invalidateQueries');
      await screen.findByLabelText('Дата');
      if (target) {
        fireEvent.change(screen.getByLabelText('Дата'), { target: { value: target } });
        save();
      } else fireEvent.click(screen.getByRole('button', { name: 'Снять дату' }));
      await waitFor(() => expect(apiClient.calendar.update).toHaveBeenCalledTimes(1));
      await waitFor(() => {
        for (const key of ranges) expect(view.client.getQueryState(key)?.isInvalidated).toBe(true);
      });
      expect(view.client.getQueryState(other)?.isInvalidated).toBe(false);
      expect(view.client.getQueryState(pageKeys.list(projectId))?.isInvalidated).toBe(true);
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: pageKeys.detail(page.id) }),
      );
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: calendarEntryKeys.project(projectId) }),
      );
      await waitFor(() =>
        expect(view.client.getQueryData(['calendar-entry', projectId, 'page', page.id])).toEqual(
          target ? { ...entry, date: target } : null,
        ),
      );
    },
  );

  it.each(['different', 'failed'])(
    'does not silently overwrite after a %s CAS refetch',
    async (result) => {
      const get = vi
        .mocked(apiClient.calendar.get)
        .mockResolvedValueOnce(reply(200, { entry: null }));
      if (result === 'different')
        get.mockResolvedValue(reply(200, { entry: { ...entry, date: '2026-12-25' } }));
      else get.mockRejectedValue(new TypeError('Read failed'));
      const update = vi
        .mocked(apiClient.calendar.update)
        .mockResolvedValueOnce(failure(409) as never);
      const view = setup(page.id);
      fireEvent.change(await screen.findByLabelText('Дата'), { target: { value: date } });
      save();
      await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
      const pointKey = ['calendar-entry', projectId, 'page', page.id];
      if (result === 'failed') {
        await waitFor(() => {
          expect(view.client.getQueryState(pointKey)?.status).toBe('error');
          expect(view.client.getQueryState(pointKey)?.fetchStatus).toBe('idle');
        });
        expect(await screen.findByText(/read failed/i)).toBeVisible();
      } else {
        await waitFor(() => {
          expect(view.client.getQueryData(pointKey)).toEqual({ ...entry, date: '2026-12-25' });
          expect(view.client.getQueryState(pointKey)?.fetchStatus).toBe('idle');
        });
        expect(await screen.findByRole('button', { name: 'Подтвердить изменение' })).toBeEnabled();
      }
      await settle(view.client);
      expect(screen.getByRole('alert')).toBeVisible();
      expect(update).toHaveBeenCalledTimes(1);
      if (result === 'failed') {
        const confirm = screen.queryByRole('button', { name: 'Подтвердить изменение' });
        if (confirm) expect(confirm).toBeDisabled();
        else expect(confirm).not.toBeInTheDocument();
        const form = screen.getByLabelText('Дата').closest('form');
        expect(form).toBeInstanceOf(HTMLFormElement);
        if (!form) throw new Error('Expected the calendar PUT form');
        await submitForm(form, view.client);
        expect(update).toHaveBeenCalledTimes(1);
      } else {
        fireEvent.click(await screen.findByRole('button', { name: 'Подтвердить изменение' }));
        await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
        expect(update.mock.calls[1][0]).toEqual({
          params: { projectId, pageId: page.id },
          body: { date, expectedDate: '2026-12-25' },
        });
      }
    },
  );
});
