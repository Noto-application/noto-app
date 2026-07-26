import { Global, Logger, Module } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import type { Env } from '../config/env.schema';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService<Env, true>): Promise<Redis> => {
    const logger = new Logger('Redis');

    // lazyConnect: подключаемся вручную ниже, чтобы упасть на старте,
    // если Redis недоступен (fail-fast, как валидация env).
    const client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      // Переподключение в рантайме, если соединение оборвётся после старта.
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

    client.on('error', (err) => logger.error(`Ошибка Redis: ${err.message}`));

    try {
      await client.connect();
      logger.log('Подключение к Redis установлено');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Redis недоступен при старте: ${message}`, { cause: err });
    }

    return client;
  },
};

/**
 * Global — RedisService и клиент доступны во всех модулях.
 */
@Global()
@Module({
  providers: [redisProvider, RedisService],
  exports: [redisProvider, RedisService],
})
export class RedisModule {}
