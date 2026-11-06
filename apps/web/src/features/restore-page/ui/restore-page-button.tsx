'use client';

import { restoreConflictSchema } from '@noto/shared';
import Link from 'next/link';

import { ApiClientError } from '@/src/shared/api';
import { Button } from '@/src/shared/ui/button';
import { toast } from '@/src/shared/ui/toast';

import { useRestorePage } from '../api/use-restore-page';

function errorMessage(error: Error) {
  if (error instanceof ApiClientError) {
    if (error.code === 'FORBIDDEN') return 'Недостаточно прав для восстановления страницы.';
    if (error.code === 'NOT_FOUND') return 'Страница уже восстановлена или больше недоступна.';
    if (error.code === 'CONFLICT') {
      const conflict = restoreConflictSchema.safeParse({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      const ancestor = conflict.success ? conflict.data.details?.blockedBy : undefined;
      return ancestor
        ? `Сначала восстановите родительскую страницу «${ancestor.title}».`
        : 'Невозможно восстановить страницу в текущем дереве проекта.';
    }
  }
  return 'Не удалось восстановить страницу. Проверьте соединение и повторите попытку.';
}

export function RestorePageButton({ projectId, pageId }: { projectId: string; pageId: string }) {
  const { restore, isPending, error } = useRestorePage(projectId, pageId);

  const onRestore = async () => {
    try {
      const page = await restore();
      if (page)
        toast.success(
          'Страница восстановлена',
          <Link className="underline" href={`/app/${page.id}`}>
            Открыть «{page.title}»
          </Link>,
        );
    } catch (error) {
      // После 404 refetch может убрать строку вместе с inline-ошибкой.
      if (error instanceof ApiClientError && error.code === 'NOT_FOUND') {
        toast.info('Страница недоступна', errorMessage(error));
      }
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" loading={isPending} onClick={() => void onRestore()}>
        {isPending ? 'Восстановление…' : 'Восстановить'}
      </Button>
      {error ? (
        <p role="alert" className="max-w-sm text-body-compact text-destructive">
          {errorMessage(error)}
        </p>
      ) : null}
    </div>
  );
}
