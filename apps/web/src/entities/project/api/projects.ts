import type { Project } from '../model/types';
import { projectFixtures } from './fixtures';

export const projectKeys = {
  all: () => ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

export function getProjects(): Promise<Project[]> {
  return Promise.resolve(projectFixtures);
}

/**
 * Неизвестный id → undefined, не throw. При переходе на реальный /projects
 * API (issue #27) 404 должен маппиться сюда же в undefined, а не
 * пробрасываться как ошибка — иначе консьюмеры, завязанные на undefined,
 * сломаются на реальных данных (см. spec «Решения»).
 */
export function getProject(id: string): Promise<Project | undefined> {
  return Promise.resolve(projectFixtures.find((project) => project.id === id));
}
