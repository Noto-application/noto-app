// @vitest-environment jsdom

import type { Page } from '@noto/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPageTree } from '@/src/entities/page/lib/build-page-tree';
import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTree } from './page-tree';

type DeleteOptions = { onSuccess?: () => void; onError?: () => void };

const mocks = vi.hoisted(() => ({
  usePagesList: vi.fn(),
  usePageTree: vi.fn(),
  useDeletePageMutation: vi.fn(),
  deletePage: vi.fn<(pageId: string, options: DeleteOptions) => void>(),
  movePage: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ pageId: 'other' }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/src/entities/page', async () => {
  const { buildPageTree } = await import('@/src/entities/page/lib/build-page-tree');
  return {
    buildPageTree,
    usePagesList: mocks.usePagesList,
    usePageTree: mocks.usePageTree,
    useDeletePageMutation: mocks.useDeletePageMutation,
  };
});

vi.mock('@/src/features/move-page/api/use-move-page', () => ({
  useMovePage: () => ({ isPending: false, mutate: mocks.movePage }),
}));

vi.mock('@/src/shared/ui/toast', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

function page(id: string, title: string, parentId: string | null = null): Page {
  return {
    id,
    title,
    parentId,
    projectId: 'project-1',
    position: 0,
    content: [],
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
}

const pages = [
  page('parent', 'Обзор'),
  page('child', 'Роадмап', 'parent'),
  page('other', 'Бэклог'),
];
const initialSidebarState = useSidebarStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useSidebarStore.setState(initialSidebarState, true);
  mocks.usePagesList.mockReturnValue({ data: pages, isLoading: false });
  mocks.usePageTree.mockReturnValue({ data: buildPageTree(pages), isError: false });
  mocks.useDeletePageMutation.mockReturnValue({ isPending: false, mutate: mocks.deletePage });
});

async function openDelete(user: ReturnType<typeof userEvent.setup>, title = 'Обзор') {
  await user.click(screen.getByRole('button', { name: `Действия для «${title}»` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Удалить страницу?' });
  await waitFor(() => expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument());
  expect(dialog).toBeVisible();
  return dialog;
}

/** Меню, диалоги, строка, стор и DnD настоящие; подменены данные, мутации и роутер. */
describe('PageTree actions', () => {
  it('показывает общее меню без отдельной кнопки удаления в каждой строке', async () => {
    const user = userEvent.setup();
    render(<PageTree projectId="project-1" />);

    expect(screen.queryAllByRole('button', { name: /^Удалить/ })).toHaveLength(0);
    for (const { title } of pages) {
      expect(screen.getByRole('button', { name: `Действия для «${title}»` })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Действия для «Обзор»' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Переместить', 'Удалить']);
  });

  it('сохраняет диалог перемещения после закрытия меню и передаёт выбранное назначение', async () => {
    const user = userEvent.setup();
    render(<PageTree projectId="project-1" />);

    await user.click(screen.getByRole('button', { name: 'Действия для «Обзор»' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Переместить' }));

    const dialog = await screen.findByRole('dialog', { name: 'Переместить «Обзор»' });
    await waitFor(() =>
      expect(screen.queryByRole('menu', { hidden: true })).not.toBeInTheDocument(),
    );
    expect(dialog).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: 'Роадмап' })).not.toBeInTheDocument();
    expect(mocks.movePage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Бэклог' }));
    await user.click(within(dialog).getByRole('button', { name: 'Переместить' }));

    expect(mocks.movePage).toHaveBeenCalledExactlyOnceWith(
      { pageId: 'parent', projectId: 'project-1', parentId: 'other', position: 0 },
      expect.any(Object),
    );
    expect(mocks.deletePage).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('открывает подтверждение удаления вложенной страницы и отменяет без запроса', async () => {
    const user = userEvent.setup();
    render(<PageTree projectId="project-1" />);

    const dialog = await openDelete(user, 'Роадмап');
    expect(dialog).toHaveTextContent('Роадмап');
    expect(mocks.deletePage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.deletePage).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(useSidebarStore.getState().collapsedPageIds.size).toBe(0);
  });

  it('удаляет выбранную вложенную страницу только после подтверждения и обрабатывает успех', async () => {
    const user = userEvent.setup();
    render(<PageTree projectId="project-1" />);

    const dialog = await openDelete(user, 'Роадмап');
    expect(mocks.deletePage).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    expect(mocks.deletePage).toHaveBeenCalledExactlyOnceWith('child', expect.any(Object));
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mocks.deletePage.mock.calls[0][1].onSuccess?.());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mocks.success).toHaveBeenCalledWith(
      'Страница удалена',
      '«Роадмап» и её дочерние страницы удалены.',
    );
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/app');
  });

  it('показывает ошибку удаления и оставляет подтверждение открытым для повтора', async () => {
    const user = userEvent.setup();
    render(<PageTree projectId="project-1" />);

    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    act(() => mocks.deletePage.mock.calls[0][1].onError?.());

    expect(mocks.error).toHaveBeenCalledWith('Не удалось удалить страницу', 'Попробуйте ещё раз.');
    expect(dialog).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    expect(mocks.deletePage).toHaveBeenCalledTimes(2);
  });

  it('блокирует повторное подтверждение и отмену во время удаления', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PageTree projectId="project-1" />);

    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    mocks.useDeletePageMutation.mockReturnValue({ isPending: true, mutate: mocks.deletePage });
    rerender(<PageTree projectId="project-1" />);

    const confirm = within(dialog).getByRole('button', { name: 'Удаление' });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeDisabled();
    await user.click(confirm);
    await user.keyboard('{Escape}');
    expect(dialog).toBeVisible();
    expect(mocks.deletePage).toHaveBeenCalledTimes(1);
  });

  it.each(['Переместить', 'Удалить'])(
    '%s доступно с клавиатуры без навигации, раскрытия и drag',
    async (action) => {
      const user = userEvent.setup();
      render(<PageTree projectId="project-1" />);
      await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));

      const trigger = screen.getByRole('button', { name: 'Действия для «Обзор»' });
      const row = trigger.closest('[role="group"]');
      expect(row).not.toBeNull();
      trigger.focus();
      await user.keyboard('{ArrowDown}');
      const item = await screen.findByRole('menuitem', { name: action });
      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: 'Переместить' })).toHaveFocus(),
      );
      await user.keyboard(action === 'Удалить' ? '{End}' : '{Home}');
      await waitFor(() => expect(item).toHaveFocus());
      await user.keyboard('{Enter}');

      const dialog = await screen.findByRole(action === 'Удалить' ? 'alertdialog' : 'dialog');
      expect(row).not.toHaveAttribute('aria-pressed', 'true');
      expect(useSidebarStore.getState().collapsedPageIds.has('parent')).toBe(true);
      expect(mocks.push).not.toHaveBeenCalled();
      expect(mocks.movePage).not.toHaveBeenCalled();
      expect(mocks.deletePage).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.getByRole('link', { name: 'Бэклог' })).toHaveAttribute('aria-current', 'page');
    },
  );
});
