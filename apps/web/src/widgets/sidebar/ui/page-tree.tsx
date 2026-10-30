'use client';

import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { usePagesList, usePageTree, type Page, type PageTreeNode } from '@/src/entities/page';
import { useCreatePage } from '@/src/features/create-page';
import {
  MovePageDndContext,
  MovePageDropTarget,
  MovePagePositionDropTarget,
  MovePageRootDropTarget,
} from '@/src/features/move-page';
import { EmptyState } from '@/src/shared/ui/empty-state';
import { InlineAlert } from '@/src/shared/ui/inline-alert';
import { Skeleton } from '@/src/shared/ui/skeleton';
import { Button } from '@/src/shared/ui/button';
import { useSidebarStore } from '../model/use-sidebar-store';
import { PageTreeRow } from './page-tree-row';
import { PageActionsMenu } from './page-actions-menu';

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
  projectId,
  pages,
  createNestedPage,
  isCreatingNestedPage,
}: {
  nodes: PageTreeNode[];
  depth: number;
  activePageId: string | undefined;
  projectId: string;
  pages: Page[];
  createNestedPage: (parentId: string) => void;
  isCreatingNestedPage: boolean;
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
            <MovePagePositionDropTarget pageId={node.id} placement="before" />
            <MovePageDropTarget pageId={node.id}>
              {({ isOver, isDragging }) => (
                <PageTreeRow
                  title={node.title}
                  href={`/app/${node.id}`}
                  depth={depth}
                  isActive={node.id === activePageId}
                  isDropTarget={isOver}
                  isDragging={isDragging}
                  actions={
                    <div className="flex w-12 shrink-0 items-center">
                      <Button
                        type="button"
                        aria-label={`Создать страницу внутри «${node.title}»`}
                        size="icon"
                        variant="ghost"
                        disabled={isCreatingNestedPage}
                        onClick={() => createNestedPage(node.id)}
                        className="size-6 cursor-pointer opacity-0 hover:bg-surface-selected focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 [&_svg]:size-4"
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                      <PageActionsMenu
                        pageId={node.id}
                        projectId={projectId}
                        parentId={node.parentId}
                        title={node.title}
                        pages={pages}
                      />
                    </div>
                  }
                  {...(hasChildren
                    ? {
                        hasChildren: true,
                        isExpanded,
                        onToggle: () => togglePage(node.id),
                      }
                    : { hasChildren: false })}
                />
              )}
            </MovePageDropTarget>

            {isExpanded ? (
              <TreeNodes
                nodes={node.children}
                depth={depth + 1}
                activePageId={activePageId}
                projectId={projectId}
                pages={pages}
                createNestedPage={createNestedPage}
                isCreatingNestedPage={isCreatingNestedPage}
              />
            ) : null}
            <MovePagePositionDropTarget pageId={node.id} placement="after" />
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
  const nestedCreation = useCreatePage(projectId);
  const isCreatingRef = useRef(false);
  const wasPendingRef = useRef(false);
  const expandPages = useSidebarStore((state) => state.expandPages);

  useEffect(() => {
    if (wasPendingRef.current && !nestedCreation.isPending) isCreatingRef.current = false;
    wasPendingRef.current = nestedCreation.isPending;
  }, [nestedCreation.isPending]);

  const createNestedPage = (parentId: string) => {
    if (isCreatingRef.current || nestedCreation.isPending) return;
    isCreatingRef.current = true;
    nestedCreation.mutate(
      { parentId },
      {
        onSuccess: () => expandPages([parentId]),
        onSettled: () => {
          isCreatingRef.current = false;
        },
      },
    );
  };

  const { data: pages, isLoading } = usePagesList(projectId);

  // Тот же query key, что у usePagesList — второй сетевой запрос не уходит,
  // только пересчёт дерева. `buildPageTree` бросает на неконсистентных
  // данных (дубли id, циклы); в `select` throw уходит в `isError`, а не
  // роняет рендер.
  const { data: tree, isError: isTreeError } = usePageTree(projectId);

  // Раскрытие только на смену pageId, не на любое обновление pages — иначе
  // вручную свёрнутая ветка раскрывалась бы обратно при каждой инвалидации
  // списка.
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
      <MovePageDndContext projectId={projectId} pages={pages}>
        <TreeNodes
          nodes={tree}
          depth={0}
          activePageId={pageId}
          projectId={projectId}
          pages={pages}
          createNestedPage={createNestedPage}
          isCreatingNestedPage={nestedCreation.isPending}
        />
        <MovePageRootDropTarget pages={pages} />
      </MovePageDndContext>
    </nav>
  );
}
