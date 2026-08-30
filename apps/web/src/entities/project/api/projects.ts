import type { CreateProjectInput, Project } from '@noto/shared';

import { apiClient, toApiClientError } from '@/src/shared/api';

export const projectKeys = {
  all: () => ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

export async function getProjects(): Promise<Project[]> {
  const response = await apiClient.projects.list({});

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.projects;
}

/**
 * Неизвестный id → undefined, не throw. При переходе на реальный /projects
 * API (issue #27) 404 должен маппиться сюда же в undefined, а не
 * пробрасываться как ошибка — иначе консьюмеры, завязанные на undefined,
 * сломаются на реальных данных (см. spec «Решения»).
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const response = await apiClient.projects.get({ params: { projectId: id } });

  if (response.status === 404) {
    return undefined;
  }

  if (response.status !== 200) {
    throw toApiClientError(response.body);
  }

  return response.body.project;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const response = await apiClient.projects.create({ body: input });

  if (response.status !== 201) {
    throw toApiClientError(response.body);
  }

  return response.body.project;
}
