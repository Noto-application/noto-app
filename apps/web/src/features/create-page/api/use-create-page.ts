'use client';

import type { Page } from '@noto/shared';
import { useMutation, useQueryClient, type MutateOptions } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useRef } from 'react';

import { createPage, pageKeys, usePage } from '@/src/entities/page';
import { createProject, projectKeys, useProjects } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';

const DEFAULT_PAGE_TITLE = 'Без названия';
const DEFAULT_PROJECT_NAME = 'Мой проект';

type CreatePageInput = { title?: string; parentId?: string | null };

/**
 * Создаёт страницу в активном проекте: если открыта страница — в её
 * проекте, иначе в первом загруженном; если проектов ещё нет вовсе —
 * сначала создаёт «Мой проект». Активный проект выводится из URL, а не
 * хранится отдельным состоянием (ADR-005). Явный projectId не использует
 * фолбэк на другой проект.
 */
export function useCreatePage(projectId?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pageId } = useParams<{ pageId?: string }>();
  const pageQuery = usePage(pageId);
  const projectsQuery = useProjects();
  const successCallback = useRef<
    MutateOptions<Page, Error, CreatePageInput | undefined> | undefined
  >(undefined);

  const activeProjectId =
    projectId ?? (pageId ? pageQuery.data?.projectId : projectsQuery.data?.[0]?.id);
  const isActiveProjectPending = pageId ? pageQuery.isPending : projectsQuery.isPending;
  const isActiveProjectError = pageId ? pageQuery.isError : projectsQuery.isError;

  const mutation = useMutation<Page, Error, CreatePageInput | undefined>({
    mutationFn: async ({ title = DEFAULT_PAGE_TITLE, parentId } = {}) => {
      let targetProjectId = activeProjectId;

      if (!targetProjectId && !projectId) {
        const projects = projectsQuery.data;

        if (!projects) {
          throw new Error('Projects are not available');
        }

        if (projects.length === 0) {
          const project = await createProject({ name: DEFAULT_PROJECT_NAME });
          targetProjectId = project.id;
          await queryClient.invalidateQueries({ queryKey: projectKeys.all() });
        } else {
          targetProjectId = projects[0].id;
        }
      }

      if (!targetProjectId) {
        throw new Error('Project is not available');
      }

      return createPage(targetProjectId, { title, parentId });
    },
    onSuccess: async (page, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.list(page.projectId) });
      const callback = successCallback.current?.onSuccess;
      successCallback.current = undefined;
      callback?.(page, variables, onMutateResult, context);
      router.push(`/app/${page.id}`);
      toast.success('Страница создана', `Вы перешли на страницу «${page.title}»`);
    },
    onError: (error) => {
      successCallback.current = undefined;
      if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {
        return;
      }

      if (error instanceof ApiClientError && error.code === 'FORBIDDEN') {
        toast.error('Недостаточно прав', 'Вы не можете создавать страницы в этом проекте.');
        return;
      }

      toast.error('Не удалось создать страницу', 'Проверьте соединение и повторите попытку.');
    },
  });

  const mutate: typeof mutation.mutate = (variables, options) => {
    successCallback.current = options;
    mutation.mutate(variables, { onError: options?.onError, onSettled: options?.onSettled });
  };

  return {
    ...mutation,
    mutate,
    isProjectsPending: projectsQuery.isPending,
    isProjectsError: projectsQuery.isError,
    isActiveProjectPending,
    isActiveProjectError,
  };
}
