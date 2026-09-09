'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useDeletePageMutation } from '@/src/entities/page';
import { toast } from '@/src/shared/ui/toast';

type UseDeletePageParams = {
  pageId: string;
  title: string;
};

/**
 * Управляет удалением страницы:
 * - открывает/закрывает подтверждение;
 * - вызывает mutation удаления;
 * - показывает success/error toast;
 * - после успешного удаления перенаправляет на `/app`.
 *
 * Бизнес-логика удаления находится в entity `page`,
 * а сценарий пользовательского действия — в feature `delete-page`.
 */
export function useDeletePage({ pageId, title }: UseDeletePageParams) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const deletePageMutation = useDeletePageMutation();

  const onOpen = () => {
    if (!deletePageMutation.isPending) {
      setOpen(true);
    }
  };

  const onOpenChange = (nextOpen: boolean) => {
    if (!deletePageMutation.isPending) {
      setOpen(nextOpen);
    }
  };

  const onDelete = () => {
    deletePageMutation.mutate(pageId, {
      onSuccess: () => {
        setOpen(false);

        toast.success('Страница удалена', `«${title}» и её дочерние страницы удалены.`);

        router.push('/app');
      },
      onError: () => {
        toast.error('Не удалось удалить страницу', 'Попробуйте ещё раз.');
      },
    });
  };

  return {
    open,
    isPending: deletePageMutation.isPending,
    onOpen,
    onOpenChange,
    onDelete,
  };
}
