import type { Page } from '@noto/shared';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { updatePage } from '@/src/entities/page';

export const AUTOSAVE_DEBOUNCE_MS = 1000;

export function usePageAutosave(pageId: string) {
  const mutation = useMutation({
    mutationFn: (content: Page['content']) => updatePage(pageId, { content }),
  });

  // react-query возвращает новый `mutate` на каждом рендере — без ref
  // `flush` менял бы идентичность на каждом рендере, и эффект ниже
  // срабатывал бы не только при размонтировании.
  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingRef = useRef<Page['content'] | null>(null);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (pendingRef.current) {
      // Без обработчика ошибка молча уходит в состояние мутации, которое
      // никто не читает — правка терялась бы без единого следа.
      mutateRef.current(pendingRef.current, {
        onError: (error) => {
          console.error('Не удалось сохранить страницу', error);
        },
      });
      pendingRef.current = null;
    }
  }, []);

  const onChange = useCallback(
    (content: Page['content']) => {
      pendingRef.current = content;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { onChange };
}
