import { Hocuspocus } from '@hocuspocus/server';

import { authorizeConnection } from './auth/authorize-connection';
import { createCollabAuthApi } from './collab-auth-api';
import { loadCollabConfig } from './config/collab-env';

/**
 * Hocuspocus-сервер collaborative editing (#108). На хендшейке (`onAuthenticate`)
 * делегирует решение в authorizeConnection: origin allowlist + делегирование в
 * API по cookie/секрету, fail-closed. Persistence — вне #108 (задача #109).
 *
 * Realtime/WS не покрыт unit-тестами (спайк по CLAUDE.md) — проверяется живьём.
 */
const API_TIMEOUT_MS = 5000;

const config = loadCollabConfig(process.env);
const api = createCollabAuthApi(config.apiInternalUrl);
const logger = {
  warn: (...args: unknown[]) => console.warn('[collab]', ...args),
  info: (...args: unknown[]) => console.info('[collab]', ...args),
  error: (...args: unknown[]) => console.error('[collab]', ...args),
};

const server = new Hocuspocus({
  port: config.port,
  async onAuthenticate({ documentName, requestHeaders }) {
    const result = await authorizeConnection(
      {
        origin: requestHeaders.origin,
        cookieHeader: requestHeaders.cookie,
        documentName,
      },
      {
        allowedOrigins: config.allowedOrigins,
        secret: config.sharedSecret,
        timeoutMs: API_TIMEOUT_MS,
        api,
        logger,
      },
    );

    if (!result.allowed) {
      // throw отклоняет авторизацию: неавторизованному не отдаётся документ
      // (данные/синк). Мгновенный разрыв самого WS в 2.15.3 не гарантирован —
      // безопасность держится на отказе в доступе к контенту, не на закрытии сокета.
      throw new Error('Unauthorized');
    }

    // Контекст соединения — для будущих хуков (persistence/roles).
    return { userId: result.userId };
  },
});

void server.listen().then(() => {
  logger.info(`listening on :${config.port}, allowlist=${config.allowedOrigins.join(',')}`);
});
