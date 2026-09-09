import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { apiErrorSchema } from '../errors';

const c = initContract();

/** Тело авторизации collab-документа: documentName = pageId (#108). */
export const collabAuthorizeBodySchema = z.object({
  documentName: z.uuid(),
});

/** Успех: доступ разрешён участнику, userId для контекста соединения. */
export const collabAuthorizeResponseSchema = z.object({
  allowed: z.literal(true),
  userId: z.string().min(1),
});

/**
 * Внутренний контракт collab-авторизации (#108). НЕ входит в публичный
 * apiContract — общий источник истины только для apps/api (реализация) и
 * apps/collab (клиент). Путь вне глобального /api-префикса Nest.
 */
export const internalCollabContract = c.router({
  authorize: {
    method: 'POST',
    path: '/internal/collab/authorize',
    body: collabAuthorizeBodySchema,
    responses: {
      200: collabAuthorizeResponseSchema,
      400: apiErrorSchema,
      401: apiErrorSchema,
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Authorize collab document access (internal, service secret required)',
  },
});

export type InternalCollabContract = typeof internalCollabContract;
