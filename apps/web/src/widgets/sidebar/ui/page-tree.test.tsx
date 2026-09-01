// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTree } from './page-tree';

/**
 * `usePagesList`/`usePageTree` и строка дерева мокаются по целевому
 * контракту. `useSidebarStore` реальный — раскрытие дерева входит в
 * проверяемое поведение.
 */
const { usePagesListMock, usePageTreeMock, useParamsMock } = vi.hoisted(() => ({
  usePagesListMock: vi.fn(),
  usePageTreeMock: vi.fn(),
  useParamsMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: useParamsMock,
}));

vi.mock('@/src/entities/page', () => ({
  usePagesList: usePagesListMock,
  usePageTree: usePageTreeMock,
}));

type BranchState = { hasChildren: false } | { hasChildren: true; isExpanded: boolean };

type ItemProps = BranchState & {
  title: string;
  href: string;
  depth: number;
  isActive: boolean;
  onToggle?: () => void;
};

/**
 * Мок повторяет ARIA-контракт строки (sidebar-tree-item.spec.md), чтобы тесты
 * проверяли разметку, которую увидит скринридер, а не переданные пропсы.
 */
vi.mock('./page-tree-row', () => ({
  PageTreeRow: (props: ItemProps) => (
    <span data-depth={props.depth}>
      {props.hasChildren ? (
        <button
          type="button"
          aria-expanded={props.isExpanded}
          aria-label={`${props.isExpanded ? 'Свернуть' : 'Развернуть'} «${props.title}»`}
          onClick={props.onToggle}
        />
      ) : null}
      {/* Слот действий по контракту строки есть всегда, пока пустой. */}
      <span data-actions />
      <a href={props.href} aria-current={props.isActive ? 'page' : undefined}>
        {props.title}
      </a>
    </span>
  ),
}));

type TreeNode = { id: string; title: string; children: TreeNode[] };

/**
 * Плоский список и дерево обязаны описывать одни и те же страницы: раскрытие
 * предков идёт по `parentId` из плоского списка, а рендер — по дереву.
 */
function flatten(nodes: TreeNode[], parentId: string | null = null) {
  return nodes.flatMap((node): { id: string; title: string; parentId: string | null }[] => [
    { id: node.id, title: node.title, parentId },
    ...flatten(node.children, node.id),
  ]);
}

function mockTree(nodes: TreeNode[]) {
  usePagesListMock.mockReturnValue({ data: flatten(nodes), isLoading: false });
  usePageTreeMock.mockReturnValue({ data: nodes, isError: false });
  return nodes;
}

/** Обзор → Роадмап: один родитель с одним потомком. */
function parentWithChild(): TreeNode[] {
  return [
    {
      id: 'page-1',
      title: 'Обзор',
      children: [{ id: 'page-2', title: 'Роадмап', children: [] }],
    },
  ];
}

/** Обзор → Роадмап → Q3: три уровня. */
function threeLevels(): TreeNode[] {
  return [
    {
      id: 'page-1',
      title: 'Обзор',
      children: [
        {
          id: 'page-2',
          title: 'Роадмап',
          children: [{ id: 'page-4', title: 'Q3', children: [] }],
        },
      ],
    },
  ];
}

/** Восстановление целиком: перечисленные руками поля однажды забудут
 *  дополнить, и состояние потечёт между тестами. */
const initialSidebarState = useSidebarStore.getState();

beforeEach(() => {
  usePagesListMock.mockReset();
  usePageTreeMock.mockReset();
  useParamsMock.mockReset();
  useParamsMock.mockReturnValue({ pageId: undefined });
  useSidebarStore.setState(initialSidebarState, true);
});

describe('PageTree', () => {
  it('показывает Skeleton, пока usePagesList грузится', () => {
    usePagesListMock.mockReturnValue({ data: undefined, isLoading: true });
    usePageTreeMock.mockReturnValue({ data: undefined, isError: false });

    const { container } = render(<PageTree projectId="project-1" />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('показывает EmptyState «Нет страниц», когда у проекта нет страниц', () => {
    usePagesListMock.mockReturnValue({ data: [], isLoading: false });
    usePageTreeMock.mockReturnValue({ data: [], isError: false });

    render(<PageTree projectId="project-1" />);

    expect(screen.getByText('Нет страниц')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('показывает ошибку и не строит дерево, когда данных нет вне загрузки', () => {
    usePagesListMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    usePageTreeMock.mockReturnValue({ data: undefined, isError: false });

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить страницы');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  /** `buildPageTree` бросает на неконсистентных данных (дубли id, циклы);
   *  `usePageTree` ловит throw через `select` и отдаёт `isError`, а не роняет
   *  рендер. Без этого теста регрессия на прямой вызов buildPageTree() в
   *  рендере осталась бы незамеченной. */
  it('показывает ошибку, а не падает, когда usePageTree не может построить дерево', () => {
    usePagesListMock.mockReturnValue({ data: [{ id: 'page-1', title: 'Обзор', parentId: null }], isLoading: false });
    usePageTreeMock.mockReturnValue({ data: undefined, isError: true });

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить страницы');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('передаёт projectId в usePagesList и в usePageTree', () => {
    mockTree(parentWithChild());

    render(<PageTree projectId="project-42" />);

    expect(usePagesListMock).toHaveBeenCalledWith('project-42');
    expect(usePageTreeMock).toHaveBeenCalledWith('project-42');
  });

  it('оборачивает дерево в навигацию с меткой и вложенные списки', () => {
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);

    const nav = screen.getByRole('navigation', { name: 'Страницы' });
    const rootItem = within(nav).getAllByRole('listitem')[0];
    expect(within(rootItem).getByRole('list')).toBeInTheDocument();
  });

  it('рендерит страницы ссылками на /app/[pageId]', () => {
    mockTree([
      { id: 'page-1', title: 'Обзор', children: [] },
      { id: 'page-3', title: 'Бэклог', children: [] },
    ]);

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('link', { name: 'Обзор' })).toHaveAttribute('href', '/app/page-1');
    expect(screen.getByRole('link', { name: 'Бэклог' })).toHaveAttribute('href', '/app/page-3');
  });

  it('не рисует шеврон у страниц без детей', () => {
    mockTree([{ id: 'page-1', title: 'Обзор', children: [] }]);

    render(<PageTree projectId="project-1" />);

    // По имени, а не «нет кнопок вообще»: в слоте действий появятся свои.
    expect(screen.queryAllByRole('button', { name: /Развернуть|Свернуть/ })).toHaveLength(0);
  });

  it('передаёт вложенность и структурой списков, и через depth', () => {
    mockTree([
      {
        id: 'page-1',
        title: 'Обзор',
        children: [
          {
            id: 'page-2',
            title: 'Роадмап',
            children: [{ id: 'page-4', title: 'Q3', children: [] }],
          },
        ],
      },
    ]);

    render(<PageTree projectId="project-1" />);

    // Потомок лежит внутри элемента списка своего родителя, а не рядом с ним.
    const root = screen.getByRole('link', { name: 'Обзор' }).closest('li');
    expect(root).not.toBeNull();
    expect(within(root!).getByRole('link', { name: 'Роадмап' })).toBeInTheDocument();

    for (const [title, depth] of [
      ['Обзор', '0'],
      ['Роадмап', '1'],
      ['Q3', '2'],
    ] as const) {
      expect(screen.getByRole('link', { name: title }).closest('[data-depth]')).toHaveAttribute(
        'data-depth',
        depth,
      );
    }
  });

  it('по умолчанию дерево раскрыто: потомок виден, у родителя aria-expanded', () => {
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('button', { name: 'Свернуть «Обзор»' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Роадмап' })).toBeInTheDocument();
  });

  it('сворачивает поддерево, когда id родителя попал в collapsedPageIds', () => {
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1']) });
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('button', { name: 'Развернуть «Обзор»' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
  });

  it('клик по шеврону пишет id родителя в collapsedPageIds и прячет потомка', async () => {
    const user = userEvent.setup();
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));

    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
  });

  it('клик по шеврону свёрнутого родителя раскрывает поддерево обратно', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1']) });
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Развернуть «Обзор»' }));

    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(false);
    expect(screen.getByRole('link', { name: 'Роадмап' })).toBeInTheDocument();
  });

  it('сворачивание прячет всё поддерево, а не только прямых потомков', async () => {
    const user = userEvent.setup();
    mockTree(threeLevels());

    render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));

    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Q3' })).not.toBeInTheDocument();
  });

  it('рендерит узлы в порядке из usePageTree и не сортирует их сам', () => {
    mockTree([
      { id: 'page-3', title: 'Бэклог', children: [] },
      { id: 'page-1', title: 'Обзор', children: [] },
    ]);

    render(<PageTree projectId="project-1" />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Бэклог',
      'Обзор',
    ]);
  });

  it('сворачивание одного родителя не трогает поддерево соседнего', async () => {
    const user = userEvent.setup();
    mockTree([
      ...parentWithChild(),
      {
        id: 'page-3',
        title: 'Бэклог',
        children: [{ id: 'page-5', title: 'Идеи', children: [] }],
      },
    ]);

    render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));

    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Идеи' })).toBeInTheDocument();
  });

  /** Цепочка предков берётся по `parentId` из плоского списка: без раскрытия
   *  активная страница осталась бы невидимой в дереве. */
  it('раскрывает свёрнутых предков активной страницы', () => {
    useParamsMock.mockReturnValue({ pageId: 'page-2' });
    useSidebarStore.setState({ collapsedPageIds: new Set(['page-1']) });
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('link', { name: 'Роадмап' })).toBeInTheDocument();
    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(false);
  });

  /** Предки раскрываются на переходе, а не на каждом рендере: иначе шеврон на
   *  ветке с активной страницей нерабочий — свернул, оно раскрылось обратно. */
  it('не мешает свернуть родителя, находясь на его потомке', async () => {
    const user = userEvent.setup();
    useParamsMock.mockReturnValue({ pageId: 'page-2' });
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));

    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(true);
  });

  /** pages в зависимостях эффекта — любое обновление списка, не только смена
   *  pageId, иначе раскрывало бы предка заново поверх ручного сворачивания. */
  it('не раскрывает вручную свёрнутого предка повторно, когда pages обновился без смены pageId', async () => {
    const user = userEvent.setup();
    useParamsMock.mockReturnValue({ pageId: 'page-2' });
    mockTree(parentWithChild());

    const { rerender } = render(<PageTree projectId="project-1" />);
    await user.click(screen.getByRole('button', { name: 'Свернуть «Обзор»' }));
    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(true);

    // pages обновился (новая ссылка на массив, тот же pageId) — например,
    // список страниц инвалидировался по несвязанной причине.
    usePagesListMock.mockReturnValue({ data: flatten(parentWithChild()), isLoading: false });
    rerender(<PageTree projectId="project-1" />);

    expect(useSidebarStore.getState().collapsedPageIds.has('page-1')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Роадмап' })).not.toBeInTheDocument();
  });

  it('помечает aria-current="page" только страницу из URL, не её родителей', () => {
    useParamsMock.mockReturnValue({ pageId: 'page-2' });
    mockTree(parentWithChild());

    render(<PageTree projectId="project-1" />);

    expect(screen.getByRole('link', { name: 'Роадмап' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Обзор' })).not.toHaveAttribute('aria-current');
  });
});
