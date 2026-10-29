'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/src/entities/user';
import { toast } from '@/src/shared/ui/toast';
import { avatarPreviewKey } from '../model/avatar-preview';

/**
 * Прототип issue #127 без backend (#126 ещё не готов): файл не уходит на
 * сервер — весь «upload» это `readFileAsDataUrl` ниже. Результат живёт в
 * своём ключе кэша ({@link module:features/update-avatar/model/avatar-preview})
 * текущей сессии — сбрасывается при перезагрузке. Сетевой вызов изолирован
 * в `mutationFn` — когда появится реальный API, менять нужно будет только
 * его.
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function useUpdateAvatar() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation<string, Error, File>({
    mutationFn: async (file) => {
      if (!currentUser) {
        throw new Error('Current user is not available');
      }

      // Симуляция сетевой задержки — заменить на реальный upload (issue #126).
      await new Promise((resolve) => setTimeout(resolve, 600));

      return readFileAsDataUrl(file);
    },
    onSuccess: (avatarUrl) => {
      if (currentUser) {
        queryClient.setQueryData(avatarPreviewKey(currentUser.id), avatarUrl);
      }
      toast.success('Аватар обновлён', 'Изменение видно только в этой сессии — без сохранения на сервере.');
    },
    onError: () => {
      toast.error('Не удалось загрузить аватар', 'Попробуйте другой файл или повторите позже.');
    },
  });
}

export function useRemoveAvatar() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  return function removeAvatar() {
    if (!currentUser) return;

    queryClient.setQueryData(avatarPreviewKey(currentUser.id), null);
    toast.success('Аватар удалён');
  };
}
