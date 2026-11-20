'use client';

import { projectsContract } from '@noto/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { usePage, usePagesList } from '@/src/entities/page';
import { projectKeys, useProject, useProjects } from '@/src/entities/project';
import { ApiClientError } from '@/src/shared/api';
import { useCurrentNavigationIntent } from '@/src/shared/lib/navigation-intent';

type Status =
  | 'ready'
  | 'pending'
  | 'invalid'
  | 'forbidden'
  | 'unavailable'
  | 'page-missing'
  | 'error'
  | 'no-projects'
  | 'chooser'
  | 'global';

/** Композиция сущностей над entities: URL и Page — единственные источники выбора. */
export function useProjectContext(canonicalize = false, hasBootstrapIntent?: () => boolean) {
  const { pageId } = useParams<{ pageId?: string }>();
  const router = useRouter();
  const navigation = useCurrentNavigationIntent();
  const { pathname, params } = navigation;
  const projects = useProjects();
  const queryClient = useQueryClient();
  const page = usePage(pageId);
  const values = params.getAll('projectId');
  const explicit = values.length > 0;
  const valid =
    explicit &&
    values.every((value) => value === values[0]) &&
    projectsContract.get.pathParams.safeParse({ projectId: values[0] }).success;
  const global = pathname === '/app/settings';
  const urlProjectId = !pageId && !global && valid ? values[0] : undefined;
  const fallbackEligible =
    !pageId && !global && !explicit && (pathname === '/app' || pathname === '/app/calendar');
  // Захватываем намерение до ответа списка, а не при его завершении.
  const fallbackIntent = useRef<{ revision: number; isCurrent: () => boolean } | null>(null);
  const fallbackId = fallbackEligible && projects.isSuccess ? projects.data[0]?.id : undefined;
  const project = useProject(urlProjectId);
  useEffect(() => {
    const request = projects.isPending
      ? queryClient.getQueryCache().find({ queryKey: projectKeys.all(), exact: true })?.promise
      : undefined;
    const isCurrent = navigation.captureRequest(request);
    const revision = navigation.getRevision();
    if (fallbackEligible && fallbackIntent.current?.revision !== revision) {
      fallbackIntent.current = { revision, isCurrent };
    }
    // Календарь сам канонизирует проект вместе с месяцем.
    if (
      !canonicalize ||
      pathname !== '/app' ||
      !fallbackId ||
      hasBootstrapIntent?.() ||
      !fallbackIntent.current?.isCurrent()
    )
      return;
    const next = new URLSearchParams(params.toString());
    next.set('projectId', fallbackId);
    const canonical = `/app?${next.toString()}`;
    navigation.markCanonical(canonical);
    router.replace(canonical);
  }, [
    canonicalize,
    hasBootstrapIntent,
    fallbackId,
    fallbackEligible,
    projects.isPending,
    projects.isSuccess,
    projects.data,
    navigation,
    pathname,
    params,
    router,
    queryClient,
  ]);

  let status: Status;
  let projectId: string | undefined;
  if (pageId) {
    if (page.isError)
      status =
        page.error instanceof ApiClientError && ['FORBIDDEN', 'NOT_FOUND'].includes(page.error.code)
          ? 'page-missing'
          : 'error';
    else if (page.isPending) status = 'pending';
    else if (!page.data) status = 'page-missing';
    else {
      status = 'ready';
      projectId = page.data.projectId;
    }
  } else if (global) status = 'global';
  else if (explicit) {
    if (!valid) status = 'invalid';
    else if (project.isError)
      status =
        project.error instanceof ApiClientError && project.error.code === 'FORBIDDEN'
          ? 'forbidden'
          : 'error';
    else if (project.isPending) status = 'pending';
    else if (!project.data) status = 'unavailable';
    else {
      status = 'ready';
      projectId = urlProjectId;
    }
  } else if (!fallbackEligible) status = 'chooser';
  else if (projects.isError) status = 'error';
  else if (projects.isPending) status = 'pending';
  else if (!fallbackId) status = 'no-projects';
  else {
    status = 'ready';
    projectId = fallbackId;
  }

  const pages = usePagesList(projectId);
  // Наличие проекта в справочнике не отменяет окончательный отказ Pages API.
  if (
    pages.error instanceof ApiClientError &&
    ['FORBIDDEN', 'NOT_FOUND'].includes(pages.error.code)
  ) {
    status = pages.error.code === 'FORBIDDEN' ? 'forbidden' : 'unavailable';
    projectId = undefined;
  }

  return {
    status,
    projectId,
    projects,
    navigation,
    project: projectId
      ? pageId
        ? projects.data?.find((item) => item.id === projectId)
        : (project.data ?? projects.data?.find((item) => item.id === projectId))
      : undefined,
    canCreate: status === 'ready' || status === 'no-projects',
    linksBlocked: !['ready', 'no-projects', 'chooser', 'global'].includes(status),
    retry: () => void (pageId ? page.refetch() : explicit ? project.refetch() : projects.refetch()),
  };
}
