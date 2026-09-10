import { initClient } from '@ts-rest/core';
import { internalCollabContract } from '@noto/shared/internal';

import type { CollabAuthApi } from './auth/authorize-connection';

/**
 * Клиент к internal collab-authorize endpoint API (#108). Один контракт с API
 * (@noto/shared/internal). Пробрасывает access_token как Cookie (тот же
 * механизм, что REST) и сервисный секрет заголовком; возвращает сырой
 * { status, body } — интерпретирует их authorizeConnection (fail-closed).
 */
export function createCollabAuthApi(apiInternalUrl: string): CollabAuthApi {
  const client = initClient(internalCollabContract, {
    baseUrl: apiInternalUrl.replace(/\/$/, ''),
    baseHeaders: {},
  });

  return {
    async authorize({ documentName, accessToken, secret, signal }) {
      const response = await client.authorize({
        body: { documentName },
        extraHeaders: {
          'x-collab-secret': secret,
          cookie: `access_token=${accessToken}`,
        },
        fetchOptions: { signal },
      });

      return { status: response.status, body: response.body };
    },
  };
}
