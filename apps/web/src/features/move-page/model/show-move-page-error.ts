import { ApiClientError } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';

/** Показывает пользователю результат неудачной попытки перемещения страницы. */
export function showMovePageError(error: Error): void {
  if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {
    return;
  }

  if (error instanceof ApiClientError && error.code === 'FORBIDDEN') {
    toast.error('Недостаточно прав', 'Вы не можете перемещать страницы в этом проекте.');
    return;
  }

  toast.error('Не удалось переместить страницу', 'Проверьте соединение и повторите попытку.');
}
