// @vitest-environment jsdom

import type { Page } from '@noto/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from '@/src/shared/ui/toast';

import { MovePageDndContext, MovePageDropTarget } from '@/src/features/move-page';
import { PageActionsMenu } from './page-actions-menu';

type MoveInput = {
  pageId: string;
  projectId: string;
  parentId: string | null;
  position: number;
};

type MoveOptions = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

const { mutate, useMovePageMock } = vi.hoisted(() => ({
  mutate: vi.fn<(input: MoveInput, options: MoveOptions) => void>(),
  useMovePageMock: vi.fn(),
}));

vi.mock('@/src/features/move-page/api/use-move-page', () => ({
  useMovePage: useMovePageMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/src/entities/page', async () => {
  const { buildPageTree } = await import('@/src/entities/page/lib/build-page-tree');
  return {
    buildPageTree,
    useDeletePageMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

function page(id: string, parentId: string | null = null, position = 0): Page {
  return {
    id,
    projectId: 'project-1',
    parentId,
    title: id,
    content: [],
    position,
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  };
}

beforeEach(() => {
  mutate.mockReset();
  useMovePageMock.mockReturnValue({ isPending: false, mutate });
});

describe('PageActionsMenu', () => {
  it('открывает меню с клавиатуры внутри draggable строки', async () => {
    const user = userEvent.setup();
    const pages = [page('moving')];

    render(
      <MovePageDndContext projectId="project-1" pages={pages}>
        <MovePageDropTarget pageId="moving">
          {() => (
            <PageActionsMenu
              pageId="moving"
              projectId="project-1"
              parentId={null}
              title="moving"
              pages={pages}
            />
          )}
        </MovePageDropTarget>
      </MovePageDndContext>,
    );

    screen.getByRole('button', { name: 'Действия для «moving»' }).focus();
    await user.keyboard('{ArrowDown}');

    expect(await screen.findByRole('menuitem', { name: 'Переместить' })).toBeInTheDocument();
  });

  it('открывает диалог, исключает поддерево и перемещает страницу в конец нового родителя', async () => {
    const user = userEvent.setup();
    const pages = [
      page('root'),
      page('moving', 'root', 0),
      page('child', 'moving'),
      page('parent'),
      page('existing-child', 'parent', 0),
    ];

    render(
      <PageActionsMenu
        pageId="moving"
        projectId="project-1"
        parentId="root"
        title="moving"
        pages={pages}
      />,
    );

    screen.getByRole('button', { name: 'Действия для «moving»' }).focus();
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('menuitem', { name: 'Переместить' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'child' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'root' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'parent' }));
    await user.click(within(dialog).getByRole('button', { name: 'Переместить' }));

    const [input, options] = mutate.mock.calls[0];

    expect(input).toEqual({
      pageId: 'moving',
      projectId: 'project-1',
      parentId: 'parent',
      position: 1,
    });
    expect(options.onSuccess).toEqual(expect.any(Function));
  });

  it('показывает ошибку, если страницу не удалось переместить', async () => {
    const user = userEvent.setup();
    const pages = [page('moving'), page('parent')];

    render(
      <>
        <Toaster />
        <PageActionsMenu
          pageId="moving"
          projectId="project-1"
          parentId={null}
          title="moving"
          pages={pages}
        />
      </>,
    );

    screen.getByRole('button', { name: 'Действия для «moving»' }).focus();
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('menuitem', { name: 'Переместить' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'parent' }));
    await user.click(within(dialog).getByRole('button', { name: 'Переместить' }));

    act(() => {
      mutate.mock.calls[0][1].onError?.(new Error('Network error'));
    });

    expect(await screen.findByText('Не удалось переместить страницу')).toBeInTheDocument();
    expect(screen.getByText('Проверьте соединение и повторите попытку.')).toBeInTheDocument();
  });
});
