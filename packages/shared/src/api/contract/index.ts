import { initContract } from '@ts-rest/core';

import { authContract } from './auth';
import { projectsContract } from './projects';

const c = initContract();

/** Корневой API-контракт Noto. Префикс /api добавляет Nest (main.ts setGlobalPrefix). */
export const apiContract = c.router({
  auth: authContract,
  projects: projectsContract,
});

export type ApiContract = typeof apiContract;
