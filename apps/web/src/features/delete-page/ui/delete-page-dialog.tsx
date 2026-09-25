'use client';

import type { ComponentProps } from 'react';

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

type DeletePageDialogProps = {
  title: string;
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  finalFocus?: ComponentProps<typeof AlertDialogContent>['finalFocus'];
};

export function DeletePageDialog({
  title,
  open,
  isPending,
  onOpenChange,
  onDelete,
  finalFocus,
}: DeletePageDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent finalFocus={finalFocus}>
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
  );
}
