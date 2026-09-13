'use client';

import type { Page } from '@noto/shared';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/src/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/shared/ui/dropdown-menu';
import { MovePageDialog } from './move-page-dialog';

type MovePageMenuProps = {
  pageId: string;
  projectId: string;
  parentId: string | null;
  title: string;
  pages: Page[];
};

export function MovePageMenu({ pageId, projectId, parentId, title, pages }: MovePageMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button aria-label={`Действия для «${title}»`} size="icon" variant="ghost">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>Переместить</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MovePageDialog
        pageId={pageId}
        projectId={projectId}
        parentId={parentId}
        title={title}
        pages={pages}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
