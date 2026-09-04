import { createTestApp, resetAuthState } from './helpers/test-app';
import { RedisRefreshTokenStore } from '../src/auth/refresh-token.store';
import type { AuthTokens } from '../src/types/auth.types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function tokensFor(userId: string, jti: string): AuthTokens {
  return {
    accessToken: `access-${jti}`,
    refreshToken: `refresh-${jti}`,
    refreshJti: jti,
    userId,
    persistent: false,
  };
}

/**
 * E2E против реального Redis.
 * revokeAllForUser (#22): SCAN-путь по HTTP напрямую не дёргается.
 * rotateWithGrace (#50): атомарность гонки нельзя проверить на моке.
 */
describe('RedisRefreshTokenStore (e2e)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let store: RedisRefreshTokenStore;

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    store = app.get(RedisRefreshTokenStore);
  });

  beforeEach(async () => {
    await resetAuthState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('отзыв всех токенов юзера', () => {
    it('удаляет все refresh-ключи юзера, чужие не трогает', async () => {
      await store.store('user-a', 'jti-1', 100);
      await store.store('user-a', 'jti-2', 100);
      await store.store('user-b', 'jti-x', 100);

      await store.revokeAllForUser('user-a');

      expect(await store.isActive('user-a', 'jti-1')).toBe(false);
      expect(await store.isActive('user-a', 'jti-2')).toBe(false);
      expect(await store.isActive('user-b', 'jti-x')).toBe(true);
    });

    it('идемпотентен, когда активных токенов нет', async () => {
      await expect(store.revokeAllForUser('ghost')).resolves.toBeUndefined();
    });
  });

  describe('ротация с grace-окном (#50)', () => {
    const userId = 'user-a';
    const oldJti = 'jti-old';
    const refreshTtl = 100;

    it('не принимает неизвестный jti и не записывает новый', async () => {
      const result = await store.rotateWithGrace(
        userId,
        oldJti,
        'jti-new',
        tokensFor(userId, 'jti-new'),
        refreshTtl,
        10,
      );

      expect(result).toEqual({ kind: 'missing' });
      expect(await redis.client.get(`refresh:${userId}:jti-new`)).toBeNull();
    });

    it('повтор в grace-окне отдаёт ту же пару победителя и не записывает чужой jti', async () => {
      await store.store(userId, oldJti, refreshTtl);
      const winner = tokensFor(userId, 'jti-new');
      const loser = tokensFor(userId, 'jti-other');

      const first = await store.rotateWithGrace(
        userId,
        oldJti,
        winner.refreshJti,
        winner,
        refreshTtl,
        10,
      );
      const second = await store.rotateWithGrace(
        userId,
        oldJti,
        loser.refreshJti,
        loser,
        refreshTtl,
        10,
      );

      expect(first).toEqual({ kind: 'rotated' });
      expect(second).toEqual({ kind: 'replay', tokens: winner });
      expect(await redis.client.get(`refresh:${userId}:${winner.refreshJti}`)).toBe('1');
      expect(await redis.client.get(`refresh:${userId}:${loser.refreshJti}`)).toBeNull();

      const grace = await redis.client.get(`refresh:${userId}:${oldJti}`);
      expect(grace).not.toBeNull();
      expect(grace).not.toBe('1');
    });

    it('из двух параллельных вызовов один ротирует, второй получает ту же пару', async () => {
      await store.store(userId, oldJti, refreshTtl);
      const tokensA = tokensFor(userId, 'jti-a');
      const tokensB = tokensFor(userId, 'jti-b');

      const results = await Promise.all([
        store.rotateWithGrace(userId, oldJti, tokensA.refreshJti, tokensA, refreshTtl, 10),
        store.rotateWithGrace(userId, oldJti, tokensB.refreshJti, tokensB, refreshTtl, 10),
      ]);

      const kinds = results.map((result) => result.kind).sort();
      expect(kinds).toEqual(['replay', 'rotated']);

      const activeA = await redis.client.get(`refresh:${userId}:jti-a`);
      const activeB = await redis.client.get(`refresh:${userId}:jti-b`);
      expect([activeA, activeB].filter((value) => value === '1')).toHaveLength(1);

      const winner = activeA === '1' ? tokensA : tokensB;
      const replay = results.find((result) => result.kind === 'replay');
      expect(replay).toEqual({ kind: 'replay', tokens: winner });
    });

    it('после истечения grace-окна старый jti больше не принимается', async () => {
      await store.store(userId, oldJti, refreshTtl);
      const winner = tokensFor(userId, 'jti-new');

      await store.rotateWithGrace(userId, oldJti, winner.refreshJti, winner, refreshTtl, 1);

      const during = await store.rotateWithGrace(
        userId,
        oldJti,
        'jti-during',
        tokensFor(userId, 'jti-during'),
        refreshTtl,
        1,
      );
      expect(during.kind).toBe('replay');

      await delay(2100);

      const after = await store.rotateWithGrace(
        userId,
        oldJti,
        'jti-late',
        tokensFor(userId, 'jti-late'),
        refreshTtl,
        1,
      );
      expect(after).toEqual({ kind: 'missing' });
      expect(await redis.client.get(`refresh:${userId}:${winner.refreshJti}`)).toBe('1');
    });

    it('отзыв grace-ключа снимает и новый jti', async () => {
      await store.store(userId, oldJti, refreshTtl);
      const winner = tokensFor(userId, 'jti-new');

      await store.rotateWithGrace(userId, oldJti, winner.refreshJti, winner, refreshTtl, 10);
      await store.revoke(userId, oldJti);

      expect(await store.isActive(userId, oldJti)).toBe(false);
      expect(await store.isActive(userId, winner.refreshJti)).toBe(false);
    });

    it('отзыв всех токенов юзера снимает и grace, и новый jti; чужие ключи не трогает', async () => {
      await store.store(userId, oldJti, refreshTtl);
      const winner = tokensFor(userId, 'jti-new');
      await store.rotateWithGrace(userId, oldJti, winner.refreshJti, winner, refreshTtl, 10);
      await store.store('user-b', 'jti-x', refreshTtl);

      await store.revokeAllForUser(userId);

      expect(await redis.client.get(`refresh:${userId}:${oldJti}`)).toBeNull();
      expect(await redis.client.get(`refresh:${userId}:${winner.refreshJti}`)).toBeNull();
      expect(await store.isActive('user-b', 'jti-x')).toBe(true);
    });
  });
});
