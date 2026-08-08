import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import type { RefreshTokenStore } from '../types/auth.types';

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

  async revoke(userId: string, jti: string): Promise<void> {
    await this.redis.client.del(this.key(userId, jti));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const keys = await this.redis.client.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.client.del(...keys);
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
