'use client';

import { Trash } from 'lucide-react';

import { useDeletePage } from '../model/use-delete-page';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/shared/ui/alert-dialog';
import { Button } from '@/src/shared/ui/button';

type DeletePageProps = {
  pageId: string;
  title: string;
};

export function DeletePage({ pageId, title }: DeletePageProps) {
  const { open, isPending, onOpen, onOpenChange, onDelete } = useDeletePage({
    pageId,
    title,
  });

  return (
    <>
      <button
        type="button"
        aria-label={`Удалить «${title}»`}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-selected hover:text-destructive [&_svg]:size-4"
        onClick={onOpen}
      >
        <Trash className="size-4" />
      </button>

      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить страницу?</AlertDialogTitle>

            <AlertDialogDescription>
              Страница &laquo;{title}&raquo; и&nbsp;все её&nbsp;дочерние страницы будут удалены. Это
              действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onDelete}
              loading={isPending}
            >
              {isPending ? 'Удаление' : 'Удалить'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
