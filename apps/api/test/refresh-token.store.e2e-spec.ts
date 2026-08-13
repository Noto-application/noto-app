import { createTestApp, resetAuthState } from './helpers/test-app';
import { RedisRefreshTokenStore } from '../src/auth/refresh-token.store';

/**
 * E2E против реального Redis: SCAN-путь в revokeAllForUser (#22) по HTTP
 * напрямую не дёргается, а мокать scanStream смысла нет — проверяем на живом
 * клиенте, что курсорный обход находит и удаляет ровно ключи юзера.
 */
describe('RedisRefreshTokenStore.revokeAllForUser (e2e)', () => {
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
