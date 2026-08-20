import type { Page } from '../model/types';
import { pageFixtures } from './fixtures';

export const pageKeys = {
  byProject: (projectId: string) => ['pages', 'project', projectId] as const,
  detail: (id: string) => ['pages', id] as const,
};

export function getPagesByProject(projectId: string): Promise<Page[]> {
  return Promise.resolve(pageFixtures.filter((page) => page.projectId === projectId));
}

/**
 * Неизвестный id → undefined, не throw — тот же контракт, что и у
 * entities/project/api/projects.ts: при переходе на реальный API 404
 * маппится сюда же, не пробрасывается как ошибка.
 */
export function getPage(id: string): Promise<Page | undefined> {
  return Promise.resolve(pageFixtures.find((page) => page.id === id));
}
