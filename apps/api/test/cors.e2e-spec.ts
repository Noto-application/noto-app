import type { Server } from 'node:http';
import request from 'supertest';

import { createTestApp, TEST_CORS_ORIGIN } from './helpers/test-app';

/**
 * E2E CORS preflight — регрессия на issue #96.
 *
 * Юнит/обычные e2e ходят same-origin через supertest и preflight не дёргают,
 * поэтому пропустили, что `@fastify/cors` без явных `methods` отдаёт дефолт
 * `GET,HEAD,POST` — браузер режет `PATCH`/`DELETE` (автосейв редактора,
 * удаление страницы). Здесь проверяем сам OPTIONS-ответ CORS-слоя.
 *
 * Origin явно задаётся тестовым приложением и не зависит от локального .env.
 */
const SOME_PAGE = '/api/pages/00000000-0000-4000-8000-000000000001';

describe('CORS preflight (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];

  beforeAll(async () => {
    const context = await createTestApp();
    app = context.app;
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('разрешает PATCH на preflight страницы', async () => {
    const response = await request(server)
      .options(SOME_PAGE)
      .set('Origin', TEST_CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH');

    expect(response.headers['access-control-allow-methods']).toMatch(/PATCH/i);
    expect(response.headers['access-control-allow-origin']).toBe(TEST_CORS_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('разрешает DELETE на preflight страницы', async () => {
    const response = await request(server)
      .options(SOME_PAGE)
      .set('Origin', TEST_CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'DELETE');

    expect(response.headers['access-control-allow-methods']).toMatch(/DELETE/i);
  });
});
