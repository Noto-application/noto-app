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

/** Параметр пути документа (documentName = pageId). */
export const collabDocumentParamsSchema = z.object({ pageId: z.uuid() });

/** Тело сохранения снапшота: base64 Yjs-update + монотонная версия (#109). */
export const collabStoreBodySchema = z.object({
  state: z.string().min(1),
  version: z.number().int().nonnegative(),
});

/** Ответ загрузки снапшота: base64 состояние + сохранённая версия. */
export const collabDocumentResponseSchema = z.object({
  state: z.string().min(1),
  version: z.number().int().nonnegative(),
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
      // rest-страница с непустым контентом не может открыться в collab (#109).
      409: apiErrorSchema,
    },
    summary: 'Authorize collab document access (internal, service secret required)',
  },

  // Persistence Yjs-снапшота (#109). Оба — вне /api, за сервисным секретом.
  loadDocument: {
    method: 'GET',
    path: '/internal/collab/documents/:pageId',
    pathParams: collabDocumentParamsSchema,
    responses: {
      200: collabDocumentResponseSchema,
      204: c.noBody(), // существующая страница без снапшота
      403: apiErrorSchema,
      404: apiErrorSchema,
    },
    summary: 'Load Yjs snapshot for a page (internal)',
  },
  storeDocument: {
    method: 'PUT',
    path: '/internal/collab/documents/:pageId',
    pathParams: collabDocumentParamsSchema,
    body: collabStoreBodySchema,
    responses: {
      200: c.noBody(),
      400: apiErrorSchema, // невалидный base64 / не Yjs-update
      403: apiErrorSchema,
      404: apiErrorSchema,
      409: apiErrorSchema, // version не новее сохранённого
      413: apiErrorSchema, // снапшот больше лимита
    },
    summary: 'Store Yjs snapshot for a page (internal, version-guarded)',
  },
});

export type InternalCollabContract = typeof internalCollabContract;
