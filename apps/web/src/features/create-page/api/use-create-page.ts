'use client';

import type { Page } from '@noto/shared';
import { useMutation, useQueryClient, type MutateOptions } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { createPage, pageKeys } from '@/src/entities/page';
import { createProject, projectKeys } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';
import { useProjectContext } from '../model/use-project-context';

const DEFAULT_PAGE_TITLE = 'Без названия';
const DEFAULT_PROJECT_NAME = 'Мой проект';

type CreatePageInput = { title?: string; parentId?: string | null };

/** Создание в разрешённом контексте; вложенная точка передаёт проект дерева. */
export function useCreatePage(projectId?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const partial = useRef<{
    projectId?: string;
    uncertain?: boolean;
    isCurrent: () => boolean;
  } | null>(null);
  const resolved = useProjectContext(!projectId, () => partial.current?.isCurrent() ?? false);
  const projectsQuery = resolved.projects;
  const [uncertainIntent, setUncertainIntent] = useState<(() => boolean) | null>(null);
  const successCallbacks = useRef(
    new Map<
      CreatePageInput,
      {
        callback?: NonNullable<
          MutateOptions<Page, Error, CreatePageInput | undefined>['onSuccess']
        >;
        variables: CreatePageInput | undefined;
        isCurrent: () => boolean;
        targetProjectId?: string;
        canBootstrap: boolean;
      }
    >(),
  );

  const isActiveProjectPending = resolved.status === 'pending';
  const isActiveProjectError =
    (!resolved.canCreate && !isActiveProjectPending) || (uncertainIntent?.() ?? false);

  const mutation = useMutation<Page, Error, CreatePageInput | undefined>({
    retry: false,
    mutationFn: async (variables) => {
      const { title = DEFAULT_PAGE_TITLE, parentId } = variables ?? {};
      const entry = variables && successCallbacks.current.get(variables);
      if (!entry || !entry.isCurrent()) throw new Error('Navigation intent expired');
      let targetProjectId = entry.targetProjectId;
      if (!targetProjectId && entry.canBootstrap) {
        const intent = { isCurrent: entry.isCurrent } as NonNullable<typeof partial.current>;
        partial.current = intent;
        try {
          const project = await createProject({ name: DEFAULT_PROJECT_NAME });
          intent.projectId = project.id;
          targetProjectId = project.id;
          entry.targetProjectId = project.id;
        } catch (error) {
          // Без идемпотентного POST исход неизвестен: обновить список и выбрать проект явно.
          intent.uncertain = true;
          if (entry.isCurrent()) setUncertainIntent(() => entry.isCurrent);
          void queryClient.invalidateQueries({ queryKey: projectKeys.all() });
          throw error;
        }
        await queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        if (!entry.isCurrent()) throw new Error('Navigation intent expired');
      }

      if (!targetProjectId) {
        throw new Error('Project is not available');
      }

      return createPage(targetProjectId, { title, parentId });
    },
    onSuccess: async (page, variables, onMutateResult, context) => {
      const entry = variables && successCallbacks.current.get(variables);
      if (variables) successCallbacks.current.delete(variables);
      await queryClient.invalidateQueries({ queryKey: pageKeys.list(page.projectId) });
      if (!entry?.isCurrent()) return;
      partial.current = null;
      entry.callback?.(page, entry.variables, onMutateResult, context);
      router.push(`/app/${page.id}`);
      toast.success('Страница создана', `Вы перешли на страницу «${page.title}»`);
    },
    onError: (error, variables) => {
      const entry = variables && successCallbacks.current.get(variables);
      if (variables) successCallbacks.current.delete(variables);
      if (entry?.targetProjectId) {
        void queryClient.invalidateQueries({ queryKey: pageKeys.list(entry.targetProjectId) });
      }
      if (!entry?.isCurrent()) return;
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {
        return;
      }

      if (error instanceof ApiClientError && error.code === 'FORBIDDEN') {
        toast.error('Недостаточно прав', 'Вы не можете создавать страницы в этом проекте.');
        return;
      }

      toast.error(
        'Не удалось создать страницу',
        partial.current?.uncertain
          ? 'Обновите список проектов и выберите проект перед новой попыткой.'
          : 'Проверьте соединение и повторите попытку.',
      );
    },
  });

  const invocation = (
    variables: CreatePageInput | undefined,
    options?: MutateOptions<Page, Error, CreatePageInput | undefined>,
  ) => {
    if (partial.current && !partial.current.isCurrent()) partial.current = null;
    const invocationVariables = { ...variables };
    successCallbacks.current.set(invocationVariables, {
      callback: options?.onSuccess,
      variables,
      isCurrent: resolved.navigation.capture(),
      targetProjectId:
        projectId ??
        partial.current?.projectId ??
        (resolved.canCreate ? resolved.projectId : undefined),
      canBootstrap: !projectId && resolved.status === 'no-projects' && !partial.current?.uncertain,
    });
    return invocationVariables;
  };
  const mutate: typeof mutation.mutate = (variables, options) => {
    const invocationVariables = invocation(variables, options);
    mutation.mutate(invocationVariables, {
      onError: (error, _variables, onMutateResult, context) =>
        options?.onError?.(error, variables, onMutateResult, context),
      onSettled: (data, error, _variables, onMutateResult, context) =>
        options?.onSettled?.(data, error, variables, onMutateResult, context),
    });
  };

  return {
    ...mutation,
    mutate,
    mutateAsync: (
      variables: CreatePageInput | undefined,
      options?: MutateOptions<Page, Error, CreatePageInput | undefined>,
    ) =>
      mutation.mutateAsync(invocation(variables, options), {
        onError: (error, _variables, onMutateResult, context) =>
          options?.onError?.(error, variables, onMutateResult, context),
        onSettled: (data, error, _variables, onMutateResult, context) =>
          options?.onSettled?.(data, error, variables, onMutateResult, context),
      }),
    resolved,
    isProjectsPending: projectsQuery.isPending,
    isProjectsError: projectsQuery.isError,
    isActiveProjectPending,
    isActiveProjectError,
  };
}
