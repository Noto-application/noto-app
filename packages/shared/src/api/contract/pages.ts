import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import {
  createPageSchema,
  pageResponseSchema,
  pagesResponseSchema,
  trashQuerySchema,
  trashResponseSchema,
  updatePageSchema,
} from '../schemas/page';

const c = initContract();

const projectIdParamSchema = z.object({ projectId: z.uuid() });
const pageIdParamSchema = z.object({ pageId: z.uuid() });
export const restoreConflictSchema = z.strictObject({
  code: z.literal('CONFLICT'),
  message: z.string(),
  details: z
    .strictObject({
      blockedBy: z.strictObject({ id: z.uuid(), title: z.string() }),
    })
    .optional(),
});

/**
 * Pages CRUD (ADR-011; спека apps/api/src/pages/pages.spec.md). Страница живёт
 * внутри проекта, права наследуются от него. Коллекция вложена в проект,
 * item — плоско; для item-роутов guard резолвит projectId из страницы.
 */
export const pagesContract = c.router({
  trash: {
    method: 'GET',
    path: '/projects/:projectId/trash/pages',
    pathParams: projectIdParamSchema,
    query: trashQuerySchema,
    responses: {
      200: trashResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'List deleted pages of a project (viewer+)',
  },
  restore: {
    method: 'POST',
    path: '/pages/:pageId/restore',
    pathParams: pageIdParamSchema,
    body: c.noBody(),
    responses: {
      200: pageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
      409: restoreConflictSchema,
    },
    summary: 'Restore one deleted page (editor+)',
  },
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
    path: '/pages/:pageId',
    pathParams: pageIdParamSchema,
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
    path: '/pages/:pageId',
    pathParams: pageIdParamSchema,
    body: updatePageSchema,
    responses: {
      200: pageResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
      // Запрос с `content` на collab-странице (тело живёт в Yjs, #109).
      409: apiErrorSchema,
    },
    summary: 'Update a page: title / content / move (editor+)',
  },
  delete: {
    method: 'DELETE',
    path: '/pages/:pageId',
    pathParams: pageIdParamSchema,
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
