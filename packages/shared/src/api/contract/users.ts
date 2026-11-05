import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';
import { avatarUploadResponseSchema, createAvatarUploadSchema } from '../schemas/avatar';
import { updateUserSchema, userResponseSchema } from '../schemas/user';

const c = initContract();

const userIdParamSchema = z.object({ userId: z.uuid() });

/**
 * Профиль пользователя (issue #124; спека apps/api/src/users/users.spec.md).
 * Создание — в auth. Здесь профиль и операции с username и аватаром.
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
    createAvatarUpload: {
      method: 'POST',
      path: '/me/avatar/uploads',
      body: createAvatarUploadSchema,
      responses: {
        201: avatarUploadResponseSchema,
        400: apiErrorSchema,
        401: apiErrorSchema,
      },
      summary: 'Create a presigned upload for the current user avatar',
    },
    confirmAvatarUpload: {
      method: 'POST',
      path: '/me/avatar/uploads/:uploadId/confirm',
      pathParams: z.object({ uploadId: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: userResponseSchema,
        400: apiErrorSchema,
        401: apiErrorSchema,
        403: apiErrorSchema,
        404: apiErrorSchema,
      },
      summary: 'Confirm and activate an avatar upload',
    },
    deleteAvatar: {
      method: 'DELETE',
      path: '/me/avatar',
      body: c.noBody(),
      responses: {
        200: userResponseSchema,
        401: apiErrorSchema,
      },
      summary: 'Remove the current user avatar',
    },
  },
  {
    pathPrefix: '/users',
  },
);
