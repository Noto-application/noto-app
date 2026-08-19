import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import {
  createPageSchema,
  pageResponseSchema,
  pagesResponseSchema,
  updatePageSchema,
} from '../schemas/page';

const c = initContract();

const projectIdParamSchema = z.object({ projectId: z.uuid() });
const idParamSchema = z.object({ id: z.uuid() });

/**
 * Pages CRUD (ADR-011; спека apps/api/src/pages/pages.spec.md). Страница живёт
 * внутри проекта, права наследуются от него. Коллекция вложена в проект,
 * item — плоско; для item-роутов guard резолвит projectId из страницы.
 */
export const pagesContract = c.router({
  create: {
    method: 'POST',
    path: '/projects/:projectId/pages',
    pathParams: projectIdParamSchema,
    body: createPageSchema,
    responses: {
      201: pageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Create a page in a project (editor+)',
  },
  list: {
    method: 'GET',
    path: '/projects/:projectId/pages',
    pathParams: projectIdParamSchema,
    responses: {
      200: pagesResponseSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'List pages of a project (viewer+)',
  },
  get: {
    method: 'GET',
    path: '/pages/:id',
    pathParams: idParamSchema,
    responses: {
      200: pageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Get a page by id (viewer+)',
  },
  update: {
    method: 'PATCH',
    path: '/pages/:id',
    pathParams: idParamSchema,
    body: updatePageSchema,
    responses: {
      200: pageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Update a page: title / content / move (editor+)',
  },
  delete: {
    method: 'DELETE',
    path: '/pages/:id',
    pathParams: idParamSchema,
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Soft-delete a page and its subtree (editor+)',
  },
});
