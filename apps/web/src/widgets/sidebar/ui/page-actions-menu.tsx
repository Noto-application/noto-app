'use client';

import type { Page } from '@noto/shared';
import { MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';

import { DeletePageDialog, useDeletePage } from '@/src/features/delete-page';
import { MovePageDialog } from '@/src/features/move-page';
import { Button } from '@/src/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/ui/dropdown-menu';

type PageActionsMenuProps = {
  pageId: string;
  projectId: string;
  parentId: string | null;
  title: string;
  pages: Page[];
};

export function PageActionsMenu({
  pageId,
  projectId,
  parentId,
  title,
  pages,
}: PageActionsMenuProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const deletePage = useDeletePage({ pageId, title });
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          render={
            <Button
              aria-label={`Действия для «${title}»`}
              className="size-6 cursor-pointer hover:bg-surface-selected [&_svg]:size-4"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMoveOpen(true)}>Переместить</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={deletePage.onOpen}>
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Диалоги вне меню: закрытие dropdown не должно размонтировать их. */}
      {moveOpen ? (
        <MovePageDialog
          pageId={pageId}
          projectId={projectId}
          parentId={parentId}
          title={title}
          pages={pages}
          open={moveOpen}
          onOpenChange={setMoveOpen}
          finalFocus={triggerRef}
        />
      ) : null}
      <DeletePageDialog
        title={title}
        open={deletePage.open}
        isPending={deletePage.isPending}
        onOpenChange={deletePage.onOpenChange}
        onDelete={deletePage.onDelete}
        finalFocus={triggerRef}
      />
    </>
  );
}
