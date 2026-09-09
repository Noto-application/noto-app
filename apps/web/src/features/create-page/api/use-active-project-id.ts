'use client';

import { useParams } from 'next/navigation';

import { usePage } from '@/src/entities/page';
import { useProjects } from '@/src/entities/project';

/**
 * Явного «активного проекта» в состоянии нет (ADR-005) — он выводится из
 * URL: если открыта страница, берём её projectId, иначе фоллбэк на первый
 * загруженный проект.
 */
export function useActiveProjectId(): {
  projectId: string | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const { pageId } = useParams<{ pageId?: string }>();
  const pageQuery = usePage(pageId);
  const projectsQuery = useProjects();

  if (pageId) {
    return {
      projectId: pageQuery.data?.projectId,
      isPending: pageQuery.isPending,
      isError: pageQuery.isError,
    };
  }

  return {
    projectId: projectsQuery.data?.[0]?.id,
    isPending: projectsQuery.isPending,
    isError: projectsQuery.isError,
  };
}
