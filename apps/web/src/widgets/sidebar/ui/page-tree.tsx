'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { usePagesList, usePageTree, type Page, type PageTreeNode } from '@/src/entities/page';
import { EmptyState } from '@/src/shared/ui/empty-state';
import { InlineAlert } from '@/src/shared/ui/inline-alert';
import { Skeleton } from '@/src/shared/ui/skeleton';
import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTreeRow } from './page-tree-row';

/** Путь от активной страницы к корню — по `parentId` из плоского списка. */
function collectAncestorIds(pages: Page[], pageId: string | undefined) {
  if (!pageId) return [];

  const byId = new Map(pages.map((page) => [page.id, page]));
  const ancestorIds: string[] = [];

  let current = byId.get(pageId)?.parentId ?? null;

  while (current) {
    ancestorIds.push(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return ancestorIds;
}

function TreeNodes({
  nodes,
  depth,
  activePageId,
}: {
  nodes: PageTreeNode[];
  depth: number;
  activePageId: string | undefined;
}) {
  const collapsedPageIds = useSidebarStore((state) => state.collapsedPageIds);
  const togglePage = useSidebarStore((state) => state.togglePage);

  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren && !collapsedPageIds.has(node.id);

        return (
          <li key={node.id}>
            <PageTreeRow
              title={node.title}
              href={`/app/${node.id}`}
              depth={depth}
              isActive={node.id === activePageId}
              {...(hasChildren
                ? { hasChildren: true, isExpanded, onToggle: () => togglePage(node.id) }
                : { hasChildren: false })}
            />

            {isExpanded ? (
              <TreeNodes nodes={node.children} depth={depth + 1} activePageId={activePageId} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Дерево страниц проекта (page-tree.spec.md). `projectId` приходит пропсом —
 * родитель берёт его из метаданных открытой страницы, а не из URL (ADR-002).
 */
export function PageTree({ projectId }: { projectId: string }) {
  const { pageId } = useParams<{ pageId?: string }>();
  const { data: pages, isLoading } = usePagesList(projectId);
  // Тот же query key, что у usePagesList — второй сетевой запрос не уходит,
  // только пересчёт дерева. `buildPageTree` бросает на неконсистентных
  // данных (дубли id, циклы); в `select` throw уходит в `isError`, а не
  // роняет рендер, как было бы при вызове buildPageTree() прямо здесь.
  const { data: tree, isError: isTreeError } = usePageTree(projectId);
  const expandPages = useSidebarStore((state) => state.expandPages);

  // Раскрытие только на смену pageId, не на любое обновление pages — иначе
  // вручную свёрнутая ветка раскрывалась бы обратно при каждой инвалидации
  // списка. pages остаётся в зависимостях: без него раскрытие не сработало
  // бы при заходе по прямой ссылке, пока список ещё грузится.
  const expandedForPageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!pages) return;
    if (expandedForPageIdRef.current === pageId) return;

    expandedForPageIdRef.current = pageId;
    expandPages(collectAncestorIds(pages, pageId));
  }, [pages, pageId, expandPages]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-7 w-3/5" />
      </div>
    );
  }

  if (!pages || isTreeError || !tree) {
    return (
      <InlineAlert variant="danger" className="m-2">
        Не удалось загрузить страницы
      </InlineAlert>
    );
  }

  if (tree.length === 0) {
    return (
      <EmptyState
        className="m-2 border-none px-2 py-6"
        title="Нет страниц"
        description="Создайте первую страницу в этом проекте"
      />
    );
  }

  return (
    <nav aria-label="Страницы" className="flex-1 overflow-y-auto">
      <TreeNodes nodes={tree} depth={0} activePageId={pageId} />
    </nav>
  );
}
