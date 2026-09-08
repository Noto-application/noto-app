import type { CollabAuthApi } from './auth/authorize-connection';

/**
 * HTTP-клиент к internal collab-authorize endpoint API (#108). Пробрасывает
 * access_token как Cookie (тот же механизм, что REST) и сервисный секрет
 * заголовком. Возвращает сырой { status, body } — интерпретирует их
 * authorizeConnection (fail-closed).
 */
export function createCollabAuthApi(apiInternalUrl: string): CollabAuthApi {
  const endpoint = `${apiInternalUrl.replace(/\/$/, '')}/internal/collab/authorize`;

  return {
    async authorize({ documentName, accessToken, secret, signal }) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-collab-secret': secret,
          cookie: `access_token=${accessToken}`,
        },
        body: JSON.stringify({ documentName }),
        signal,
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      return { status: response.status, body };
    },
  };
}
