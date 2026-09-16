import { initContract } from '@ts-rest/core';

import { authContract } from './auth';
import { pagesContract } from './pages';
import { projectsContract } from './projects';
import { usersContract } from './users';

const c = initContract();

/** Корневой API-контракт Noto. Префикс /api добавляет Nest (main.ts setGlobalPrefix). */
export const apiContract = c.router({
  auth: authContract,
  users: usersContract,
  projects: projectsContract,
  pages: pagesContract,
});

export type ApiContract = typeof apiContract;
