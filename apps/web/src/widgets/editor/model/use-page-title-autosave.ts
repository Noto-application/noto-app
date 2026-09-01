import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { pageKeys, updatePage } from '@/src/entities/page';

import { AUTOSAVE_DEBOUNCE_MS } from './use-page-autosave';

export function usePageTitleAutosave(pageId: string, projectId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (title: string) => updatePage(pageId, { title }),
    onSuccess: () => {
      // Сайдбар держит список/дерево страниц отдельным Query-запросом
      // (pageKeys.list) — без инвалидации он не узнает о новом заголовке,
      // пока не перефетчится по другому триггеру (фокус вкладки и т.п.).
      void queryClient.invalidateQueries({ queryKey: pageKeys.list(projectId) });
    },
  });

  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingRef = useRef<string | null>(null);

  const save = useCallback((title: string) => {
    mutateRef.current(title, {
      onError: (error) => {
        console.error('Не удалось сохранить заголовок страницы', error);
      },
    });
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    if (pendingRef.current !== null) {
      save(pendingRef.current);
      pendingRef.current = null;
    }
  }, [save]);

  const onChange = useCallback(
    (title: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      // Пустой заголовок — обычное промежуточное состояние (select-all +
      // delete), не ошибка: не шлём его на бэк, где он всё равно упадёт на
      // min-length валидации. Важно также снять уже запланированную отправку
      // предыдущего (валидного) значения — иначе оно всё равно долетит до
      // сервера, хотя пользователь его только что стёр.
      if (title.trim().length === 0) {
        pendingRef.current = null;
        return;
      }

      pendingRef.current = title;
      timeoutRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { onChange };
}
