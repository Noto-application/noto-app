// @vitest-environment jsdom

import type { Page } from '@noto/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePagesList } from '@/src/entities/page';
import { ApiClientError, apiClient } from '@/src/shared/api';
import { Toaster } from '@/src/shared/ui/toast';

import { PageTrash } from './page-trash';

const navigation = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push }),
}));

const projectId = '00000000-0000-4000-8000-000000000001';
const pageId = '00000000-0000-4000-8000-000000000002';
const otherProjectId = '00000000-0000-4000-8000-000000000003';
const item = {
  id: pageId,
  projectId,
  parentId: null,
  title: 'Deleted note',
  position: 0,
  deletedAt: '2026-11-01T00:00:00.000Z',
};
const page: Page = {
  id: pageId,
  projectId,
  parentId: null,
  title: item.title,
  position: 1,
  content: [],
  currentUserRole: 'editor',
  createdAt: item.deletedAt,
  updatedAt: item.deletedAt,
};
const empty = {
  status: 200 as const,
  body: { pages: [], nextCursor: null },
  headers: new Headers(),
};
const loaded = {
  status: 200 as const,
  body: { pages: [item], nextCursor: null },
  headers: new Headers(),
};
const restored = { status: 200 as const, body: { page }, headers: new Headers() };

function TreeObserver() {
  const query = usePagesList(projectId);
  return (
    <div aria-label="Tree">
      {query.data?.map((node) => (
        <span key={node.id}>{node.title}</span>
      ))}
    </div>
  );
}

function setup(withTree = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function View() {
    return (
      <QueryClientProvider client={client}>
        <Toaster />
        <PageTrash />
        {withTree ? <TreeObserver /> : null}
      </QueryClientProvider>
    );
  }
  const view = render(<View />);
  return { client, ...view, refresh: () => view.rerender(<View />) };
}

beforeEach(() => {
  navigation.search = `projectId=${projectId}`;
  vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
    status: 200,
    body: {
      projects: [projectId, otherProjectId].map((id) => ({
        id,
        name: id === projectId ? 'Notes' : 'Other',
        currentUserRole: 'owner' as const,
        createdAt: item.deletedAt,
        updatedAt: item.deletedAt,
      })),
    },
    headers: new Headers(),
  });
});
afterEach(() => vi.restoreAllMocks());

describe('PageTrash integration', () => {
  it('restores a row, refreshes active trash and tree, and shows a real page link', async () => {
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce(loaded)
      .mockResolvedValue(empty);
    const list = vi
      .spyOn(apiClient.pages, 'list')
      .mockResolvedValueOnce({ status: 200, body: { pages: [] }, headers: new Headers() })
      .mockResolvedValue({ status: 200, body: { pages: [page] }, headers: new Headers() });
    vi.spyOn(apiClient.pages, 'restore').mockResolvedValue(restored);
    setup(true);
    await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Открыть «Deleted note»/ })).toHaveAttribute(
      'href',
      `/app/${pageId}`,
    );
    await waitFor(() =>
      expect(within(screen.getByLabelText('Tree')).getByText(item.title)).toBeInTheDocument(),
    );
    expect(trash).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('disables restore during the request and leaves the row available for retry after an error', async () => {
    let reject!: (error: Error) => void;
    vi.spyOn(apiClient.pages, 'trash').mockResolvedValue(loaded);
    const restore = vi
      .spyOn(apiClient.pages, 'restore')
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, rejectRequest) => {
            reject = rejectRequest;
          }),
      )
      .mockResolvedValue(restored);
    setup();
    const button = await screen.findByRole('button', { name: 'Восстановить' });
    await userEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Восстановление…' })).toBeDisabled();
    reject(new TypeError('Offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось восстановить');
    expect(screen.getByText(item.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(2));
  });

  it.each([
    { error: new TypeError('Offline'), message: 'Не удалось восстановить страницу' },
    {
      error: new ApiClientError({ code: 'FORBIDDEN', message: 'Forbidden' }),
      message: 'Недостаточно прав',
    },
    {
      error: new ApiClientError({
        code: 'CONFLICT',
        message: 'Deleted ancestor',
        details: { blockedBy: { id: otherProjectId, title: 'Older root' } },
      }),
      message: 'Сначала восстановите родительскую страницу «Older root»',
    },
  ])(
    'shows $error.message after reopening the project and clears it after retry',
    async ({ error, message }) => {
      let reject!: (error: Error) => void;
      let finish!: (response: typeof restored) => void;
      let hasRestored = false;
      vi.spyOn(apiClient.pages, 'trash').mockImplementation(({ params }) =>
        Promise.resolve(params.projectId === projectId && !hasRestored ? loaded : empty),
      );
      const restore = vi
        .spyOn(apiClient.pages, 'restore')
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, rejectRequest) => {
              reject = rejectRequest;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        );
      const view = setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
      navigation.search = `projectId=${otherProjectId}`;
      view.refresh();
      expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
      navigation.search = `projectId=${projectId}`;
      view.refresh();
      expect(await screen.findByRole('button', { name: 'Восстановление…' })).toBeDisabled();
      act(() => {
        reject(error);
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Восстановить' })).toBeEnabled();

      navigation.search = `projectId=${otherProjectId}`;
      view.refresh();
      expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      navigation.search = `projectId=${projectId}`;
      view.refresh();
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      await userEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
      expect(await screen.findByRole('button', { name: 'Восстановление…' })).toBeDisabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      act(() => {
        hasRestored = true;
        finish(restored);
      });
      expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(restore).toHaveBeenCalledTimes(2);
    },
  );

  it('explains a deleted ancestor outside loaded rows without restoring it automatically', async () => {
    vi.spyOn(apiClient.pages, 'trash').mockResolvedValue(loaded);
    const restore = vi.spyOn(apiClient.pages, 'restore').mockResolvedValue({
      status: 409,
      body: {
        code: 'CONFLICT',
        message: 'Deleted ancestor',
        details: { blockedBy: { id: otherProjectId, title: 'Older root' } },
      },
      headers: new Headers(),
    });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Сначала восстановите родительскую страницу «Older root»',
    );
    expect(restore).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Страница восстановлена')).not.toBeInTheDocument();
  });

  it.each([
    [403, 'FORBIDDEN', 'нет доступа'],
    [404, 'NOT_FOUND', 'недоступен'],
  ] as const)(
    'shows list %s rather than an empty trash and supports retry',
    async (status, code, message) => {
      vi.spyOn(apiClient.pages, 'trash')
        .mockResolvedValueOnce({
          status,
          body: { code, message: 'Unavailable' },
          headers: new Headers(),
        })
        .mockResolvedValue(empty);
      setup();
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText('Корзина пуста')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
      expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    },
  );

  it('keeps a successful POST separate from a failed refresh', async () => {
    vi.spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce(loaded)
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValue(empty);
    vi.spyOn(apiClient.pages, 'restore').mockResolvedValue(restored);
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
    expect(await screen.findByText('Не удалось обновить корзину.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Открыть «Deleted note»/ })).toHaveAttribute(
      'href',
      `/app/${pageId}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
  });

  it('refreshes stale rows after restore 404 without a success notification', async () => {
    const trash = vi
      .spyOn(apiClient.pages, 'trash')
      .mockResolvedValueOnce(loaded)
      .mockResolvedValue(empty);
    vi.spyOn(apiClient.pages, 'restore').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Missing' },
      headers: new Headers(),
    });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    expect(trash).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Страница восстановлена')).not.toBeInTheDocument();
  });

  it('selects projects through URL and responds to history changes without leaking rows', async () => {
    navigation.search = '';
    const trash = vi.spyOn(apiClient.pages, 'trash').mockResolvedValue(empty);
    const view = setup();
    await screen.findByRole('option', { name: 'Notes' });
    expect(trash).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText('Проект'), projectId);
    expect(navigation.push).toHaveBeenCalledWith(`/app/trash?projectId=${projectId}`);
    navigation.search = `projectId=${projectId}`;
    view.refresh();
    expect(await screen.findByText('Корзина пуста')).toBeInTheDocument();
    navigation.search = '';
    view.refresh();
    expect(screen.queryByText('Корзина пуста')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Проект')).toHaveValue('');
  });

  it.each([
    {
      response: {
        status: 403 as const,
        body: { code: 'FORBIDDEN' as const, message: 'Unavailable' },
        headers: new Headers(),
      },
      text: 'Недостаточно прав',
    },
    {
      response: {
        status: 409 as const,
        body: { code: 'CONFLICT' as const, message: 'Unavailable' },
        headers: new Headers(),
      },
      text: 'Невозможно восстановить',
    },
  ])(
    'keeps a row after restore $response.status and explains the error',
    async ({ response, text }) => {
      vi.spyOn(apiClient.pages, 'trash').mockResolvedValue(loaded);
      vi.spyOn(apiClient.pages, 'restore').mockResolvedValue(response);
      setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Восстановить' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.getByText(item.title)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Восстановить' })).toBeEnabled();
    },
  );

  it('does not silently choose a project when the project list is empty', async () => {
    navigation.search = '';
    vi.mocked(apiClient.projects.list).mockResolvedValue({
      status: 200,
      body: { projects: [] },
      headers: new Headers(),
    });
    const trash = vi.spyOn(apiClient.pages, 'trash');
    setup();
    expect(await screen.findByText('Нет доступных проектов.')).toBeInTheDocument();
    expect(trash).not.toHaveBeenCalled();
  });

  it('does not request trash for an invalid project id', async () => {
    navigation.search = 'projectId=invalid';
    const trash = vi.spyOn(apiClient.pages, 'trash');
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('Некорректный идентификатор');
    expect(trash).not.toHaveBeenCalled();
  });
});
