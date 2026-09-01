import type { Page } from '@noto/shared';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { updatePage } from '@/src/entities/page';

export const AUTOSAVE_DEBOUNCE_MS = 1000;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function toAutosaveStatus(mutationStatus: 'idle' | 'pending' | 'error' | 'success'): AutosaveStatus {
  if (mutationStatus === 'pending') return 'saving';
  if (mutationStatus === 'success') return 'saved';
  return mutationStatus;
}

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

  const save = useCallback((content: Page['content']) => {
    // Без обработчика ошибка молча уходит в состояние мутации, которое
    // никто не читает — правка терялась бы без единого следа.
    mutateRef.current(content, {
      onError: (error) => {
        console.error('Не удалось сохранить страницу', error);
      },
    });
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (pendingRef.current) {
      save(pendingRef.current);
      pendingRef.current = null;
    }
  }, [save]);

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

  const retry = useCallback(() => {
    if (mutation.status !== 'error' || mutation.variables === undefined) {
      return;
    }

    save(mutation.variables);
  }, [mutation.status, mutation.variables, save]);

  return { onChange, status: toAutosaveStatus(mutation.status), retry };
}
