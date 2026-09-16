import { initClient } from '@ts-rest/core';
import { internalCollabContract } from '@noto/shared/internal';

export interface LoadResult {
  status: number;
  body: unknown;
}

/** Клиент persistence-endpoint API (#109): load/store Yjs-снапшота по секрету. */
export interface CollabPersistenceApi {
  load(pageId: string, secret: string): Promise<LoadResult>;
  store(pageId: string, state: string, version: number, secret: string): Promise<{ status: number }>;
}

export function createCollabPersistenceApi(apiInternalUrl: string): CollabPersistenceApi {
  const client = initClient(internalCollabContract, {
    baseUrl: apiInternalUrl.replace(/\/$/, ''),
    baseHeaders: {},
  });

  return {
    async load(pageId, secret) {
      const response = await client.loadDocument({
        params: { pageId },
        extraHeaders: { 'x-collab-secret': secret },
      });
      return { status: response.status, body: response.body };
    },
    async store(pageId, state, version, secret) {
      const response = await client.storeDocument({
        params: { pageId },
        body: { state, version },
        extraHeaders: { 'x-collab-secret': secret },
      });
      return { status: response.status };
    },
  };
}
