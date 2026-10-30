'use client';

import type { Page } from '@noto/shared';
import { useMemo, useState, type ComponentProps } from 'react';

import { buildPageTree, type PageTreeNode } from '@/src/entities/page';
import { Button } from '@/src/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/shared/ui/dialog';

import { useMovePage } from '../api/use-move-page';
import { filterMovePageCandidates } from '../model/filter-move-page-candidates';
import { getMovePageAppendPosition } from '../model/get-move-page-append-position';
import { showMovePageError } from '../model/show-move-page-error';

type MovePageDialogProps = {
  pageId: string;
  projectId: string;
  parentId: string | null;
  title: string;
  pages: Page[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus?: ComponentProps<typeof DialogContent>['finalFocus'];
};

type ParentTreeProps = {
  nodes: PageTreeNode[];
  depth: number;
  selectedParentId: string | null | undefined;
  currentParentId: string | null;
  onSelect: (parentId: string) => void;
};

function ParentTree({
  nodes,
  depth,
  selectedParentId,
  currentParentId,
  onSelect,
}: ParentTreeProps) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => {
        const isCurrentParent = node.id === currentParentId;

        return (
          <li key={node.id}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={selectedParentId === node.id}
              disabled={isCurrentParent}
              className="h-auto w-full justify-start px-2 py-1.5 text-left text-body-compact disabled:cursor-not-allowed"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => onSelect(node.id)}
            >
              {node.title}
            </Button>
            {node.children.length > 0 ? (
              <ParentTree
                nodes={node.children}
                depth={depth + 1}
                selectedParentId={selectedParentId}
                currentParentId={currentParentId}
                onSelect={onSelect}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function MovePageDialog({
  pageId,
  projectId,
  parentId,
  title,
  pages,
  open,
  onOpenChange,
  finalFocus,
}: MovePageDialogProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null | undefined>(undefined);
  const movePage = useMovePage();
  const candidateTree = useMemo(
    () => buildPageTree(filterMovePageCandidates(pages, pageId)),
    [pages, pageId],
  );
  const isRootCurrentParent = parentId === null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (movePage.isPending) return;

    if (!nextOpen) {
      setSelectedParentId(undefined);
    }

    onOpenChange(nextOpen);
  };

  const handleMove = () => {
    if (selectedParentId === undefined) return;

    movePage.mutate(
      {
        pageId,
        projectId,
        parentId: selectedParentId,
        position: getMovePageAppendPosition(pages, selectedParentId, pageId),
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
        onError: showMovePageError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Переместить «{title}»</DialogTitle>
          <DialogDescription>Выберите нового родителя для страницы.</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={selectedParentId === null}
            disabled={isRootCurrentParent}
            className="h-auto w-full justify-start px-2 py-1.5 text-left text-body-compact disabled:cursor-not-allowed"
            onClick={() => setSelectedParentId(null)}
          >
            В корень проекта
          </Button>
          <ParentTree
            nodes={candidateTree}
            depth={0}
            selectedParentId={selectedParentId}
            currentParentId={parentId}
            onSelect={setSelectedParentId}
          />
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="secondary" disabled={movePage.isPending}>
                Отмена
              </Button>
            }
          />
          <Button
            type="button"
            disabled={selectedParentId === undefined}
            loading={movePage.isPending}
            onClick={handleMove}
          >
            Переместить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
