import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { pageKeys, updatePage, type Page } from '@/src/entities/page';

import { AUTOSAVE_DEBOUNCE_MS } from './use-page-autosave';

export function usePageTitleAutosave(pageId: string, projectId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (title: string) => updatePage(pageId, { title }),
    onSuccess: (savedPage) => {
      // Дерево страниц в сайдбаре — отдельный Query-запрос (pageKeys.list),
      // без инвалидации не узнает о новом заголовке.
      void queryClient.invalidateQueries({ queryKey: pageKeys.list(projectId) });
      // Тот же класс проблемы, что и у detail-кэша content: следующий
      // монтаж страницы иначе увидел бы старый заголовок. Мержим только
      // title — по той же причине, что и у usePageAutosave.
      queryClient.setQueryData(pageKeys.detail(pageId), (old: Page | undefined) =>
        old ? { ...old, title: savedPage.title, updatedAt: savedPage.updatedAt } : savedPage,
      );
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

      // Пустой заголовок не шлём — обычное промежуточное состояние
      // (select-all + delete), а не ошибка. Таймер тоже снимаем, иначе
      // ранее запланированное непустое значение всё равно долетит до сервера.
      if (title.trim().length === 0) {
        pendingRef.current = null;
        return;
      }

      pendingRef.current = title.trim();
      timeoutRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { onChange };
}
