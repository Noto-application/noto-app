import { Hocuspocus } from '@hocuspocus/server';

import { authorizeConnection } from './auth/authorize-connection';
import { createCollabAuthApi } from './collab-auth-api';
import { createCollabPersistenceApi } from './collab-persistence-api';
import { createCollabPersistenceHooks } from './collab-persistence-hooks';
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
const persistence = createCollabPersistenceApi(config.apiInternalUrl);
const logger = {
  warn: (...args: unknown[]) => console.warn('[collab]', ...args),
  info: (...args: unknown[]) => console.info('[collab]', ...args),
  error: (...args: unknown[]) => console.error('[collab]', ...args),
};

const persistenceHooks = createCollabPersistenceHooks({
  persistence,
  sharedSecret: config.sharedSecret,
  logger,
});

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

  // Персистентность Yjs (#109). Дебаунс/макс-интервал: пишем после паузы, но не
  // реже maxDebounce даже при непрерывном вводе (иначе окно потери растёт).
  debounce: 2000,
  maxDebounce: 10000,

  // Load: поднимаем сохранённый снапшот. Ошибка загрузки → НЕ отдаём пустой док
  // (иначе затрём контент), а роняем — клиент увидит «не synced» и повторит.
  onLoadDocument: persistenceHooks.onLoadDocument,

  // Store: синхронно захватываем текущее состояние, персист — в фоне DocWriter'а
  // (сериализация, backoff-retry на 5xx/сеть, ресинк на 409). Наружу не бросаем.
  onStoreDocument: persistenceHooks.onStoreDocument,
});

void server.listen().then(() => {
  logger.info(`listening on :${config.port}, allowlist=${config.allowedOrigins.join(',')}`);
});

// Штатное завершение: даём Hocuspocus дозаписать открытые документы (flush),
// но с пределом ожидания — не висим на недоступной БД.
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal}: flushing documents…`);
  const timeout = new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    // destroy() прогоняет onStoreDocument (захват финального состояния), затем
    // ждём фоновые writer'ы — но не дольше таймаута (не висим на мёртвой БД).
    await Promise.race([
      server.destroy().then(() => persistenceHooks.flushWriters()),
      timeout,
    ]);
  } catch (error) {
    logger.error('shutdown flush failed', error);
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
