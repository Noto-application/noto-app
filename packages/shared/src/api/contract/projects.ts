import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import {
  createProjectSchema,
  projectResponseSchema,
  projectsResponseSchema,
  updateProjectSchema,
} from '../schemas/project';

const c = initContract();

const projectIdParamSchema = z.object({ projectId: z.uuid() });

/**
 * Projects CRUD (ADR-011; спека apps/api/src/projects/projects.spec.md).
 * Доступ — по роли участника проекта (owner > editor > viewer); владелец
 * выражен через ProjectMember, отдельного ownerId нет.
 */
export const projectsContract = c.router({
  create: {
    method: 'POST',
    path: '/projects',
    body: createProjectSchema,
    responses: {
      201: projectResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
    },
    summary: 'Create a project (author becomes owner)',
  },
  list: {
    method: 'GET',
    path: '/projects',
    responses: {
      200: projectsResponseSchema,
      401: apiErrorSchema,
    },
    summary: 'List projects the current user is a member of',
  },
  get: {
    method: 'GET',
    path: '/projects/:projectId',
    pathParams: projectIdParamSchema,
    responses: {
      200: projectResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Get a project by id',
  },
  update: {
    method: 'PATCH',
    path: '/projects/:projectId',
    pathParams: projectIdParamSchema,
    body: updateProjectSchema,
    responses: {
      200: projectResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Rename a project (editor or above)',
  },
  delete: {
    method: 'DELETE',
    path: '/projects/:projectId',
    pathParams: projectIdParamSchema,
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Soft-delete a project (owner only)',
  },
});
