'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Page } from '@noto/shared';
import type { KeyboardEventHandler, PointerEventHandler, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { cn } from '@/src/shared/lib/utils';

import { useMovePage } from '../api/use-move-page';
import { filterMovePageCandidates } from '../model/filter-move-page-candidates';
import { getMovePageAppendPosition } from '../model/get-move-page-append-position';
import { getMovePageDrop, type MovePageDropPlacement } from '../model/get-move-page-drop';
import { showMovePageError } from '../model/show-move-page-error';

const ROOT_DROP_ID = 'move-page-root';

type PageDropData = {
  targetPageId: string;
  placement: MovePageDropPlacement;
};

function getPositionDropId(pageId: string, placement: 'before' | 'after') {
  return `move-page-${placement}-${pageId}`;
}

function isPageDropData(value: unknown): value is PageDropData {
  if (!value || typeof value !== 'object') return false;

  const data = value as Partial<PageDropData>;

  return (
    typeof data.targetPageId === 'string' &&
    (data.placement === 'before' || data.placement === 'after' || data.placement === 'inside')
  );
}

/**
 * Указатель должен реально находиться над drop-зоной: closestCenter иначе
 * возвращает ближайшую строку даже когда drag вынесен за пределы дерева.
 * У KeyboardSensor нет координат указателя, для него остаётся навигация по
 * ближайшей цели.
 */
const detectMovePageCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

function isKeyboardInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, [role="button"], [role="menuitem"]') !==
      null
  );
}

function isPointerDragBlockedTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('button, input, textarea, select, [role="button"], [role="menuitem"]') !== null
  );
}

type MovePageDndContextProps = {
  projectId: string;
  pages: Page[];
  children: ReactNode;
};

type MovePageDndState = {
  activePageId: string | null;
  validTargetIds: ReadonlySet<string>;
};

const MovePageDndStateContext = createContext<MovePageDndState>({
  activePageId: null,
  validTargetIds: new Set(),
});

/**
 * Контекст DnD для дерева страниц. Drop на страницу добавляет её последним
 * ребёнком, а зоны перед/после страниц меняют порядок среди соседей.
 */
export function MovePageDndContext({ projectId, pages, children }: MovePageDndContextProps) {
  const movePage = useMovePage();
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const dndState = useMemo<MovePageDndState>(
    () => ({
      activePageId,
      validTargetIds: new Set(
        activePageId ? filterMovePageCandidates(pages, activePageId).map((page) => page.id) : [],
      ),
    }),
    [activePageId, pages],
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActivePageId(null);

    if (movePage.isPending || !over || typeof active.id !== 'string') {
      return;
    }

    const movingPage = pages.find((page) => page.id === active.id);

    if (!movingPage) {
      return;
    }

    const destination =
      over.id === ROOT_DROP_ID
        ? {
            parentId: null,
            position: getMovePageAppendPosition(pages, null, movingPage.id),
          }
        : isPageDropData(over.data.current)
          ? getMovePageDrop(
              pages,
              movingPage.id,
              over.data.current.targetPageId,
              over.data.current.placement,
            )
          : null;

    if (
      !destination ||
      (destination.parentId === movingPage.parentId && destination.position === movingPage.position)
    ) {
      return;
    }

    movePage.mutate(
      {
        pageId: movingPage.id,
        projectId,
        ...destination,
      },
      { onError: showMovePageError },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectMovePageCollision}
      onDragStart={({ active }) => setActivePageId(String(active.id))}
      onDragCancel={() => setActivePageId(null)}
      onDragEnd={handleDragEnd}
    >
      <MovePageDndStateContext value={dndState}>
        {children}
        <DragOverlay dropAnimation={null}>
          {activePageId ? (
            <div className="rounded-md bg-surface px-2 py-1.5 text-body-compact text-foreground shadow-lg ring-1 ring-border">
              {pages.find((page) => page.id === activePageId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </MovePageDndStateContext>
    </DndContext>
  );
}

type MovePageDropTargetProps = {
  pageId: string;
  children: (state: { isOver: boolean; isDragging: boolean }) => ReactNode;
};

/** Делает всю строку дерева источником drag и целью добавления в конец детей. */
export function MovePageDropTarget({ pageId, children }: MovePageDropTargetProps) {
  const { activePageId, validTargetIds } = useContext(MovePageDndStateContext);
  const isValidTarget = activePageId === null || validTargetIds.has(pageId);
  // Невалидные цели остаются droppable, чтобы closestCenter не выбрал вместо
  // них соседнюю валидную строку. В handleDragEnd такой drop блокируется.
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: pageId,
    data: { targetPageId: pageId, placement: 'inside' satisfies MovePageDropPlacement },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    isDragging,
  } = useDraggable({ id: pageId });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDroppableNodeRef(node);
      setDraggableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );
  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    // Основная область строки — ссылка на страницу. Она остаётся draggable,
    // иначе перетаскивание работало бы только вне текста страницы.
    if (!isPointerDragBlockedTarget(event.target)) {
      listeners?.onPointerDown?.(event);
    }
  };
  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!isKeyboardInteractiveTarget(event.target)) {
      listeners?.onKeyDown?.(event);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className="select-none"
      {...attributes}
      role="group"
      {...listeners}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      {children({ isOver: isOver && isValidTarget, isDragging })}
    </div>
  );
}

/** Тонкая зона вставки перед или после строки, видимая только во время drag. */
export function MovePagePositionDropTarget({
  pageId,
  placement,
}: {
  pageId: string;
  placement: 'before' | 'after';
}) {
  const { activePageId, validTargetIds } = useContext(MovePageDndStateContext);
  const isValidTarget = activePageId !== null && validTargetIds.has(pageId);
  const { setNodeRef, isOver } = useDroppable({
    id: getPositionDropId(pageId, placement),
    data: { targetPageId: pageId, placement },
  });

  return (
    <div
      ref={setNodeRef}
      aria-hidden="true"
      className={cn(
        'relative z-10 -my-1 flex h-2 items-center px-1',
        isValidTarget ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <span
        className={cn(
          'h-0.5 w-full rounded-full transition-colors',
          isOver && isValidTarget ? 'bg-primary' : 'bg-transparent',
        )}
      />
    </div>
  );
}

/** Появляется во время перетаскивания и позволяет перенести страницу в корень проекта. */
export function MovePageRootDropTarget({ pages }: { pages: Page[] }) {
  const { activePageId } = useContext(MovePageDndStateContext);
  const isValidTarget =
    activePageId !== null && pages.find((page) => page.id === activePageId)?.parentId !== null;
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROP_ID,
    disabled: !isValidTarget,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mx-2 mt-1 flex h-7 items-center gap-2 text-caption text-muted-foreground transition-colors',
        isValidTarget ? 'flex' : 'hidden',
        isOver && 'text-primary',
      )}
    >
      <span className={cn('h-0.5 flex-1 rounded-full bg-border', isOver && 'bg-primary')} />
      <span>В корень проекта</span>
      <span className={cn('h-0.5 flex-1 rounded-full bg-border', isOver && 'bg-primary')} />
    </div>
  );
}
