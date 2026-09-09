'use client';

import type { Page } from '@noto/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { createPage, pageKeys } from '@/src/entities/page';
import { createProject, projectKeys, useProjects } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { toast } from '@/src/shared/ui/toast';
import { useActiveProjectId } from './use-active-project-id';

const DEFAULT_PAGE_TITLE = 'Без названия';
const DEFAULT_PROJECT_NAME = 'Мой проект';

/**
 * Создаёт страницу в известном проекте. Когда проект не передан, берёт
 * активный (проект открытой страницы, иначе первый загруженный) или сначала
 * создаёт «Мой проект», если проектов ещё нет вовсе.
 */
export function useCreatePage(projectId?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectsQuery = useProjects();
  const activeProjectId = useActiveProjectId();

  const mutation = useMutation<
    Page,
    ApiClientError,
    { title?: string; parentId?: string | null } | undefined
  >({
    mutationFn: async ({ title = DEFAULT_PAGE_TITLE, parentId } = {}) => {
      let targetProjectId = projectId ?? activeProjectId.projectId;

      if (!targetProjectId) {
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

      return createPage(targetProjectId, { title, parentId });
    },
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.list(page.projectId) });
      router.push(`/app/${page.id}`);
    },
    onError: (error) => {
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

  return {
    ...mutation,
    isProjectsPending: projectsQuery.isPending,
    isProjectsError: projectsQuery.isError,
    isActiveProjectPending: activeProjectId.isPending,
    isActiveProjectError: activeProjectId.isError,
  };
}
