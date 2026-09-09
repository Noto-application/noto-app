import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import type { AuthTokens, RefreshRotationResult, RefreshTokenStore } from '../types/auth.types';

/**
 * Атомарная ротация с grace (#50).
 * KEYS[1] старый ключ, KEYS[2] новый.
 * ARGV: refreshTtl, graceTtl, JSON пары победителя, userId.
 */
const ROTATE_WITH_GRACE_LUA = `
local current = redis.call('GET', KEYS[1])
if current == false then
  return {'missing'}
end
if current == '1' then
  redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[1]))
  redis.call('SET', KEYS[1], ARGV[3], 'EX', tonumber(ARGV[2]))
  return {'rotated'}
end
local ok, parsed = pcall(cjson.decode, current)
if not ok or type(parsed) ~= 'table' or type(parsed['refreshJti']) ~= 'string' then
  return {'missing'}
end
local successorKey = 'refresh:' .. ARGV[4] .. ':' .. parsed['refreshJti']
if redis.call('GET', successorKey) ~= '1' then
  redis.call('DEL', KEYS[1])
  return {'missing'}
end
return {'replay', current}
`;

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

  async rotateWithGrace(
    userId: string,
    oldJti: string,
    newJti: string,
    tokens: AuthTokens,
    refreshTtlSeconds: number,
    graceTtlSeconds: number,
  ): Promise<RefreshRotationResult> {
    const reply = await this.redis.client.eval(
      ROTATE_WITH_GRACE_LUA,
      2,
      this.key(userId, oldJti),
      this.key(userId, newJti),
      refreshTtlSeconds,
      graceTtlSeconds,
      JSON.stringify(tokens),
      userId,
    );

    return this.toRotationResult(reply);
  }

  async revoke(userId: string, jti: string): Promise<void> {
    const value = await this.redis.client.getdel(this.key(userId, jti));
    if (!value || value === '1') {
      return;
    }

    const tokens = this.parseAuthTokens(value);
    if (tokens) {
      await this.redis.client.del(this.key(userId, tokens.refreshJti));
    }
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

  private toRotationResult(reply: unknown): RefreshRotationResult {
    if (!Array.isArray(reply) || reply.length === 0) {
      return { kind: 'missing' };
    }

    const kind = String(reply[0]);
    if (kind === 'rotated') {
      return { kind: 'rotated' };
    }

    if (kind === 'replay' && typeof reply[1] === 'string') {
      const tokens = this.parseAuthTokens(reply[1]);
      if (tokens) {
        return { kind: 'replay', tokens };
      }
    }

    return { kind: 'missing' };
  }

  private parseAuthTokens(raw: string): AuthTokens | undefined {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'accessToken' in parsed &&
        'refreshToken' in parsed &&
        'refreshJti' in parsed &&
        'userId' in parsed &&
        'persistent' in parsed &&
        typeof parsed.accessToken === 'string' &&
        typeof parsed.refreshToken === 'string' &&
        typeof parsed.refreshJti === 'string' &&
        typeof parsed.userId === 'string' &&
        typeof parsed.persistent === 'boolean'
      ) {
        return {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          refreshJti: parsed.refreshJti,
          userId: parsed.userId,
          persistent: parsed.persistent,
        };
      }
    } catch {
      return undefined;
    }
  
    return undefined;
  }
}

