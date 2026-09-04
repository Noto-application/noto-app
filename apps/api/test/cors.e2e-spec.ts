import type { Server } from 'node:http';
import request from 'supertest';

import { createTestApp } from './helpers/test-app';

/**
 * E2E CORS preflight — регрессия на issue #96.
 *
 * Юнит/обычные e2e ходят same-origin через supertest и preflight не дёргают,
 * поэтому пропустили, что `@fastify/cors` без явных `methods` отдаёт дефолт
 * `GET,HEAD,POST` — браузер режет `PATCH`/`DELETE` (автосейв редактора,
 * удаление страницы). Здесь проверяем сам OPTIONS-ответ CORS-слоя.
 *
 * Origin совпадает с CORS_ORIGIN (дефолт из env.schema) — иначе плагин не
 * вернёт заголовки доступа.
 */
const ORIGIN = 'http://localhost:3000';
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
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'PATCH');

    expect(response.headers['access-control-allow-methods']).toMatch(/PATCH/i);
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('разрешает DELETE на preflight страницы', async () => {
    const response = await request(server)
      .options(SOME_PAGE)
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'DELETE');

    expect(response.headers['access-control-allow-methods']).toMatch(/DELETE/i);
  });
});
