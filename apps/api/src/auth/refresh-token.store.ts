import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import type { AuthTokens, RefreshRotationResult, RefreshTokenStore } from '../types/auth.types';

/** Redis allow-list активных refresh-токенов (ключ `refresh:{userId}:{jti}`). */
@Injectable()
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: RedisService) {}

  async store(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.client.set(this.key(userId, jti), '1', 'EX', ttlSeconds);
  }

  async replace(
    userId: string,
    oldJti: string,
    newJti: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.client
      .multi()
      .del(this.key(userId, oldJti))
      .set(this.key(userId, newJti), '1', 'EX', ttlSeconds)
      .exec();
  }

  /**
   * Заглушка: реализация после ревью тестов issue #50.
   * Без неё `implements RefreshTokenStore` не компилируется, а e2e стора
   * не могут вызвать новый метод.
   */
  rotateWithGrace(
    _userId: string,
    _oldJti: string,
    _newJti: string,
    _tokens: AuthTokens,
    _refreshTtlSeconds: number,
    _graceTtlSeconds: number,
  ): Promise<RefreshRotationResult> {
    return Promise.reject(new Error('rotateWithGrace is not implemented (issue #50)'));
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.redis.client.del(this.key(userId, jti));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    // SCAN, не KEYS: KEYS блокирует однопоточный Redis на обход всего кейспейса.
    // SCAN идёт курсором порциями, между которыми клиент обслуживает других.
    const stream = this.redis.client.scanStream({
      match: `refresh:${userId}:*`,
      count: 100,
    }) as AsyncIterable<string[]>;

    for await (const keys of stream) {
      if (keys.length > 0) {
        await this.redis.client.del(...keys);
      }
    }
  }

  async isActive(userId: string, jti: string): Promise<boolean> {
    const result = await this.redis.client.exists(this.key(userId, jti));
    return result === 1;
  }

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }
}
