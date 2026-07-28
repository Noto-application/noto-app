import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Тонкая обёртка над ioredis. Пока отдаёт сам клиент через `client` —
 * allow-list refresh-токенов (BE-2) будет работать через него напрямую.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Соединение с Redis закрыто');
  }
}
