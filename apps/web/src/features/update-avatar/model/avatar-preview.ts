'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Прототип issue #127 без backend (#126 ещё не готов): превью живёт в
 * **своём** ключе кэша TanStack Query, отдельном от `userKeys.current()`.
 * Если бы хранили его прямо в объекте пользователя, любая инвалидация
 * профиля (например, после сохранения имени, #125) стирала бы превью
 * вместе с остальным — сервер про `avatarUrl` не знает и перетирал бы его
 * при рефетче. Отдельный ключ таких пересечений не имеет.
 *
 * `queryFn` сюда не используется: значение выставляется только через
 * `queryClient.setQueryData` ({@link module:features/update-avatar/api}),
 * `enabled: false` просто превращает запись кэша в ячейку хранения без
 * настоящего fetch. Сбрасывается при перезагрузке страницы — дальше кэш
 * не персистится.
 */
export function avatarPreviewKey(userId: string) {
  return ['avatarPreview', userId] as const;
}

export function useAvatarPreview(userId: string | undefined): string | null {
  const { data } = useQuery<string | null>({
    queryKey: avatarPreviewKey(userId ?? ''),
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });

  return data ?? null;
}
