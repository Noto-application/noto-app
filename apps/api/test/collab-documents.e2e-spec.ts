import type { Server } from 'node:http';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import type { ApiError } from '@noto/shared';
import { apiErrorSchema, authUserResponseSchema } from '@noto/shared';
import * as Y from 'yjs';

import { createTestApp, resetAuthState } from './helpers/test-app';
import type { Env } from '../src/config/env.schema';

/**
 * E2E internal collab persistence endpoints — test-first (ADR-013), контракт из
 * apps/api/src/collab/persistence.spec.md (#109).
 *
 * КРАСНЫЕ до реализации: эндпоинтов ещё нет → ответы 404.
 *
 * GET/PUT `/internal/collab/documents/:pageId` — вне глобального `/api`,
 * защищены сервисным секретом `X-Collab-Secret` (как #108). Хранят полное
 * Yjs-состояние (base64) + монотонную версию; запись — атомарный version-guard.
 */

const docPath = (pageId: string) => `/internal/collab/documents/${pageId}`;
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

/** Настоящий Yjs-update (API валидирует, что это декодируемый update). */
function yjsState(text: string): string {
  const doc = new Y.Doc();
  doc.getText('document-store').insert(0, text);
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

const stateA = yjsState('alpha');
const stateB = yjsState('beta');
// Валидный base64, но не Yjs-update (повреждённые байты).
const corruptState = Buffer.from('not-a-yjs-update').toString('base64');

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

describe('Internal collab documents (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let secret: string;

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
    secret = app.get(ConfigService<Env, true>).get('COLLAB_SHARED_SECRET', { infer: true });
  });

  beforeEach(async () => {
    await prisma.page.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await resetAuthState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(email: string): Promise<string> {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return authUserResponseSchema.parse(response.body).user.id;
  }

  async function seedPage(options: { deleted?: boolean } = {}): Promise<string> {
    const userId = await registerUser(`doc-${Math.random().toString(36).slice(2)}@example.com`);
    const project = await prisma.project.create({
      data: { name: 'P', members: { create: { userId, role: 'owner' } } },
    });
    const page = await prisma.page.create({
      data: {
        projectId: project.id,
        title: 'Page',
        parentId: null,
        position: 0,
        content: [],
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    return page.id;
  }

  function put(pageId: string, body: unknown) {
    return request(server).put(docPath(pageId)).set('X-Collab-Secret', secret).send(body as object);
  }

  function get(pageId: string) {
    return request(server).get(docPath(pageId)).set('X-Collab-Secret', secret);
  }

  describe('секрет и существование', () => {
    it('GET без секрета → 403', async () => {
      const pageId = await seedPage();
      const response = await request(server).get(docPath(pageId)).expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('GET неверный секрет → 403', async () => {
      const pageId = await seedPage();
      await request(server).get(docPath(pageId)).set('X-Collab-Secret', 'wrong').expect(403);
    });

    it('PUT без секрета → 403 и ничего не пишет', async () => {
      const pageId = await seedPage();
      await request(server).put(docPath(pageId)).send({ state: stateA, version: 1 }).expect(403);
      await get(pageId).expect(204);
    });

    it('PUT неверный секрет → 403 и ничего не пишет', async () => {
      const pageId = await seedPage();
      await request(server)
        .put(docPath(pageId))
        .set('X-Collab-Secret', 'wrong')
        .send({ state: stateA, version: 1 })
        .expect(403);
      await get(pageId).expect(204);
    });

    it('GET удалённой страницы → 404', async () => {
      const pageId = await seedPage({ deleted: true });
      const response = await get(pageId).expect(404);
      expect(parseError(response.body).code).toBe('NOT_FOUND');
    });

    it('PUT на soft-deleted страницу → 404 и не меняет прежний снапшот', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);

      await prisma.page.update({ where: { id: pageId }, data: { deletedAt: new Date() } });
      const response = await put(pageId, { state: stateB, version: 2 }).expect(404);
      expect(parseError(response.body).code).toBe('NOT_FOUND');

      // Восстанавливаем и убеждаемся, что снапшот остался прежним.
      await prisma.page.update({ where: { id: pageId }, data: { deletedAt: null } });
      const after = await get(pageId).expect(200);
      expect(after.body).toMatchObject({ state: stateA, version: 1 });
    });

    it('PUT на несуществующую страницу → 404', async () => {
      const response = await put(MISSING_ID, { state: stateA, version: 1 }).expect(404);
      expect(parseError(response.body).code).toBe('NOT_FOUND');
    });
  });

  describe('load/store round-trip и версии', () => {
    it('нет снапшота → 204 (новый документ)', async () => {
      const pageId = await seedPage();
      await get(pageId).expect(204);
    });

    it('PUT затем GET возвращает то же состояние и версию', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateA, version: 1 });
    });

    it('новая версия перезаписывает состояние', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);
      await put(pageId, { state: stateB, version: 2 }).expect(200);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateB, version: 2 });
    });

    it('устаревшая версия отклоняется (409) и не откатывает состояние', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateB, version: 2 }).expect(200);
      await put(pageId, { state: stateA, version: 1 }).expect(409);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateB, version: 2 });
    });

    it('равная версия отклоняется (409) — строго монотонно', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);
      await put(pageId, { state: stateB, version: 1 }).expect(409);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateA, version: 1 });
    });
  });

  describe('атомарность version-guard (конкурентные записи)', () => {
    it('первая вставка: два разных состояния с version 1 → один 200, один 409', async () => {
      const pageId = await seedPage();

      const [a, b] = await Promise.all([
        put(pageId, { state: stateA, version: 1 }),
        put(pageId, { state: stateB, version: 1 }),
      ]);

      const statuses = [a.status, b.status].sort((x, y) => x - y);
      expect(statuses).toEqual([200, 409]);

      // В GET — состояние победителя (того, чей PUT вернул 200).
      const winner = a.status === 200 ? stateA : stateB;
      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: winner, version: 1 });
    });

    it('конкурентное обновление той же версии поверх существующего → один 200, один 409', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);

      const stateX = yjsState('c2-x');
      const stateY = yjsState('c2-y');
      const [a, b] = await Promise.all([
        put(pageId, { state: stateX, version: 2 }),
        put(pageId, { state: stateY, version: 2 }),
      ]);

      const statuses = [a.status, b.status].sort((x, y) => x - y);
      expect(statuses).toEqual([200, 409]);

      // В GET — состояние победителя, не проигравшего и не старое.
      const winner = a.status === 200 ? stateX : stateY;
      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: winner, version: 2 });
    });
  });

  describe('валидация payload', () => {
    it('валидный base64, но не Yjs-update → 400, прежнее состояние сохраняется', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);

      await put(pageId, { state: corruptState, version: 2 }).expect(400);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateA, version: 1 });
    });

    it('невалидный base64 → 400', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: 'not!!base64', version: 1 }).expect(400);
    });

    it('пустое состояние → 400', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: '', version: 1 }).expect(400);
    });

    it('отсутствует version → 400', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA }).expect(400);
    });

    it('превышение лимита размера → 413, прежнее состояние сохраняется', async () => {
      const pageId = await seedPage();
      await put(pageId, { state: stateA, version: 1 }).expect(200);

      // Свыше конфигурируемого лимита (черновик 8 MB) — точный порог в реализации.
      const oversized = 'A'.repeat(12 * 1024 * 1024);
      await put(pageId, { state: oversized, version: 2 }).expect(413);

      const response = await get(pageId).expect(200);
      expect(response.body).toMatchObject({ state: stateA, version: 1 });
    });
  });
});
