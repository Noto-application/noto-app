import type { Server } from 'node:http';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import type { ApiError } from '@noto/shared';
import { apiErrorSchema, authUserResponseSchema } from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';
import type { Env } from '../src/config/env.schema';

/**
 * E2E перехода страницы в collab и его гонок с REST — test-first (ADR-013),
 * контракт из apps/api/src/collab/persistence.spec.md (#109), раздел
 * «Первый переход в collab».
 *
 * КРАСНЫЕ до реализации: сейчас authorize не промоутит режим, `editorMode` в DTO
 * нет, а PATCH тела не различает режим.
 *
 * Правила:
 * - `editorMode` страницы отдаётся в DTO (`GET /api/pages/:id`), по умолчанию `rest`.
 * - authorize (#108) промоутит `rest→collab` ТОЛЬКО для пустой страницы; на
 *   `rest` с непустым контентом collab-connect отклоняется (409).
 * - уже `collab` → authorize пускает (общий документ).
 * - PATCH тела (`content`) разрешён только в `rest`; в `collab` → 409, заголовок
 *   PATCH-ается всегда.
 */

const AUTHORIZE_PATH = '/internal/collab/authorize';

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

// DTO страницы после реализации #109 получит editorMode; читаем типизированно,
// не как any (lint).
type PageDtoView = { editorMode?: string; content?: unknown[] };
function pageView(body: unknown): PageDtoView {
  return body as PageDtoView;
}

describe('Collab promotion & REST race (e2e)', () => {
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

  async function registerUser(email: string): Promise<{ cookie: string; userId: string }> {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const accessCookie = setCookie.find((c) => c.startsWith('access_token='));
    if (!accessCookie) throw new Error('no access_token cookie in register response');
    return { cookie: accessCookie.split(';')[0], userId: authUserResponseSchema.parse(response.body).user.id };
  }

  async function seedPage(
    userId: string,
    options: { content?: unknown[] } = {},
  ): Promise<string> {
    const project = await prisma.project.create({
      data: { name: 'P', members: { create: { userId, role: 'owner' } } },
    });
    const page = await prisma.page.create({
      data: {
        projectId: project.id,
        title: 'Page',
        parentId: null,
        position: 0,
        content: (options.content ?? []) as object[],
      },
    });
    return page.id;
  }

  function authorize(cookie: string, pageId: string) {
    return request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId });
  }

  function getPage(cookie: string, pageId: string) {
    return request(server).get(`/api/pages/${pageId}`).set('Cookie', cookie);
  }

  it('DTO страницы содержит editorMode, по умолчанию rest', async () => {
    const { cookie, userId } = await registerUser('pr-dto@example.com');
    const pageId = await seedPage(userId);

    const response = await getPage(cookie, pageId).expect(200);
    expect(pageView(response.body).editorMode).toBe('rest');
  });

  it('authorize пустой rest-страницы промоутит её в collab', async () => {
    const { cookie, userId } = await registerUser('pr-promote@example.com');
    const pageId = await seedPage(userId);

    await authorize(cookie, pageId).expect(200);

    const response = await getPage(cookie, pageId).expect(200);
    expect(pageView(response.body).editorMode).toBe('collab');
  });

  it('authorize rest-страницы с контентом отклоняет collab (409), режим не меняется', async () => {
    const { cookie, userId } = await registerUser('pr-hascontent@example.com');
    const pageId = await seedPage(userId, { content: [{ type: 'paragraph' }] });

    const response = await authorize(cookie, pageId).expect(409);
    expect(parseError(response.body).code).toBe('CONFLICT');

    const page = await getPage(cookie, pageId).expect(200);
    expect(pageView(page.body).editorMode).toBe('rest');
  });

  it('уже collab → повторный authorize пускает к общему документу', async () => {
    const { cookie, userId } = await registerUser('pr-join@example.com');
    const pageId = await seedPage(userId);

    await authorize(cookie, pageId).expect(200); // промоут
    await authorize(cookie, pageId).expect(200); // join

    const page = await getPage(cookie, pageId).expect(200);
    expect(pageView(page.body).editorMode).toBe('collab');
  });

  it('два одновременных первых подключения → оба 200, режим стал collab (промоут один раз)', async () => {
    const { cookie, userId } = await registerUser('pr-concurrent@example.com');
    const pageId = await seedPage(userId);

    const [a, b] = await Promise.all([authorize(cookie, pageId), authorize(cookie, pageId)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const page = await getPage(cookie, pageId).expect(200);
    expect(pageView(page.body).editorMode).toBe('collab');
  });

  describe('PATCH тела ↔ режим', () => {
    it('PATCH content на collab-странице → 409, заголовок PATCH-ается', async () => {
      const { cookie, userId } = await registerUser('pr-patch-collab@example.com');
      const pageId = await seedPage(userId);
      await authorize(cookie, pageId).expect(200); // → collab

      await request(server)
        .patch(`/api/pages/${pageId}`)
        .set('Cookie', cookie)
        .send({ content: [{ type: 'paragraph', content: 'x' }] })
        .expect(409);

      await request(server)
        .patch(`/api/pages/${pageId}`)
        .set('Cookie', cookie)
        .send({ title: 'Новый заголовок' })
        .expect(200);
    });

    it('гонка промоут ↔ PATCH тела: взаимное исключение (не collab с контентом)', async () => {
      const { cookie, userId } = await registerUser('pr-race@example.com');
      const pageId = await seedPage(userId);

      const raceContent = [{ type: 'paragraph', content: 'race' }];
      const [authRes, patchRes] = await Promise.all([
        authorize(cookie, pageId),
        request(server)
          .patch(`/api/pages/${pageId}`)
          .set('Cookie', cookie)
          .send({ content: raceContent }),
      ]);

      // Ровно один победитель — строго (200,409) или (409,200), не два успеха и
      // не два отказа.
      const pair = [authRes.status, patchRes.status].sort((x, y) => x - y);
      expect(pair).toEqual([200, 409]);

      const page = await getPage(cookie, pageId).expect(200);
      const view = pageView(page.body);
      if (authRes.status === 200) {
        // Промоут выиграл → collab, тело осталось пустым (PATCH отклонён).
        expect(view.editorMode).toBe('collab');
        expect(view.content).toEqual([]);
      } else {
        // REST-запись выиграла → страница rest с сохранённым контентом.
        expect(view.editorMode).toBe('rest');
        expect(view.content).toEqual(raceContent);
      }
    });
  });
});
