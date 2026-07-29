import { initContract } from '@ts-rest/core';

import { apiErrorSchema } from '../errors';
import { authCredentialsSchema, authUserResponseSchema } from '../schemas/auth';

const c = initContract();

/**
 * Auth-эндпoинты: register, login, refresh, logout, me.
 * Токены — только в HttpOnly cookie, не в теле ответа (ADR-003).
 */
export const authContract = c.router(
  {
    register: {
      method: 'POST',
      path: '/register',
      body: authCredentialsSchema,
      responses: {
        201: authUserResponseSchema,
        400: apiErrorSchema,
        409: apiErrorSchema,
      },
      summary: 'Register a new user',
    },
    login: {
      method: 'POST',
      path: '/login',
      body: authCredentialsSchema,
      responses: {
        200: authUserResponseSchema,
        400: apiErrorSchema,
        401: apiErrorSchema,
      },
      summary: 'Login with email and password',
    },
    refresh: {
      method: 'POST',
      path: '/refresh',
      body: c.noBody(),
      responses: {
        200: c.noBody(),
        401: apiErrorSchema,
      },
      summary: 'Refresh access token using refresh cookie',
    },
    logout: {
      method: 'POST',
      path: '/logout',
      body: c.noBody(),
      responses: {
        200: c.noBody(),
        204: c.noBody(),
      },
      summary: 'Logout and clear auth cookies',
    },
    me: {
      method: 'GET',
      path: '/me',
      responses: {
        200: authUserResponseSchema,
        401: apiErrorSchema,
      },
      summary: 'Get current authenticated user',
    },
  },
  {
    pathPrefix: '/auth',
  },
);
