import type { Project } from '@noto/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/src/shared/api';

import { createProject, getProject, getProjects, projectKeys } from './projects';

type ProjectsResponse = Awaited<ReturnType<typeof apiClient.projects.list>>;
type ProjectResponse = Awaited<ReturnType<typeof apiClient.projects.get>>;
type CreateProjectResponse = Awaited<ReturnType<typeof apiClient.projects.create>>;

const project: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Мой проект',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('projectKeys', () => {
  it('создаёт ключи запросов проектов', () => {
    expect(projectKeys.all()).toEqual(['projects']);
    expect(projectKeys.detail(project.id)).toEqual(['projects', project.id]);
  });
});

describe('getProjects', () => {
  it('возвращает проекты из успешного ответа API', async () => {
    const list = vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 200,
      body: { projects: [project] },
      headers: new Headers(),
    } satisfies ProjectsResponse);

    await expect(getProjects()).resolves.toEqual([project]);
    expect(list).toHaveBeenCalledWith({});
  });

  it('пробрасывает ошибку API', async () => {
    vi.spyOn(apiClient.projects, 'list').mockResolvedValue({
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      headers: new Headers(),
    } satisfies ProjectsResponse);

    await expect(getProjects()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('getProject', () => {
  it('возвращает проект из успешного ответа API', async () => {
    const get = vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
      status: 200,
      body: { project },
      headers: new Headers(),
    } satisfies ProjectResponse);

    await expect(getProject(project.id)).resolves.toEqual(project);
    expect(get).toHaveBeenCalledWith({ params: { projectId: project.id } });
  });

  it('возвращает undefined для отсутствующего проекта', async () => {
    vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Not found' },
      headers: new Headers(),
    } satisfies ProjectResponse);

    await expect(getProject(project.id)).resolves.toBeUndefined();
  });

  it('не маскирует ошибку доступа как отсутствие проекта', async () => {
    vi.spyOn(apiClient.projects, 'get').mockResolvedValue({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Forbidden' },
      headers: new Headers(),
    } satisfies ProjectResponse);

    await expect(getProject(project.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('createProject', () => {
  it('создаёт проект через API', async () => {
    const create = vi.spyOn(apiClient.projects, 'create').mockResolvedValue({
      status: 201,
      body: { project },
      headers: new Headers(),
    } satisfies CreateProjectResponse);

    await expect(createProject({ name: 'Мой проект' })).resolves.toEqual(project);
    expect(create).toHaveBeenCalledWith({ body: { name: 'Мой проект' } });
  });
});
