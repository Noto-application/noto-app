import type { Page } from '../model/types';

export const pageFixtures: Page[] = [
  { id: 'page-1', title: 'Обзор', projectId: 'project-1', parentId: null },
  { id: 'page-2', title: 'Роадмап', projectId: 'project-1', parentId: 'page-1' },
  { id: 'page-3', title: 'Бэклог', projectId: 'project-1', parentId: null },
];
