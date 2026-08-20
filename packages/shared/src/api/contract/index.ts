import { initContract } from '@ts-rest/core';

import { authContract } from './auth';
import { pagesContract } from './pages';
import { projectsContract } from './projects';

const c = initContract();

/** Корневой API-контракт Noto. Префикс /api добавляет Nest (main.ts setGlobalPrefix). */
export const apiContract = c.router({
  auth: authContract,
  projects: projectsContract,
  pages: pagesContract,
});

export type ApiContract = typeof apiContract;
