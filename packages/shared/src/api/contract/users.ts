import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import { updateUserSchema, userResponseSchema } from '../schemas/user';

const c = initContract();

const userIdParamSchema = z.object({ userId: z.uuid() });

/**
 * Профиль пользователя (issue #124; спека apps/api/src/users/users.spec.md).
 * Создание — в auth. Здесь только чтение своего профиля и смена username.
 */
export const usersContract = c.router(
  {
    me: {
      method: 'GET',
      path: '/me',
      responses: {
        200: userResponseSchema,
        401: apiErrorSchema,
      },
      summary: 'Get the current user profile',
    },
    update: {
      method: 'PATCH',
      path: '/:userId',
      pathParams: userIdParamSchema,
      body: updateUserSchema,
      responses: {
        200: userResponseSchema,
        400: apiErrorSchema,
        401: apiErrorSchema,
        403: apiErrorSchema,
        404: apiErrorSchema,
      },
      summary: 'Set or change username (own profile only)',
    },
  },
  {
    pathPrefix: '/users',
  },
);
