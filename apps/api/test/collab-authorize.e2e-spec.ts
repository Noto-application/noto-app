import type { Server } from 'node:http';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ApiError } from '@noto/shared';
import { apiErrorSchema, authUserResponseSchema } from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';
import type { Env } from '../src/config/env.schema';

/**
 * E2E internal collab-authorize endpoint — test-first (ADR-013), контракт из
 * docs/specs/108-collab-auth.spec.md.
 *
 * Красные до реализации: пока эндпоинта нет, ответы 404.
 *
 * Эндпоинт живёт ВНЕ глобального префикса `/api` — путь `/internal/collab/authorize`.
 * Аутентификация пользователя — той же access-cookie, что REST; сервисный
 * секрет `X-Collab-Secret` ограничивает вызов только от collab.
 */

const AUTHORIZE_PATH = '/internal/collab/authorize';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

type Role = 'owner' | 'editor' | 'viewer';

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

describe('Internal collab authorize (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];
  let jwt: JwtService;
  let secret: string;

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
    jwt = app.get(JwtService);
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

  /** Регистрирует пользователя, возвращает его access-cookie и id. */
  async function registerUser(
    email: string,
  ): Promise<{ cookie: string; userId: string }> {
    const response = await request(server)
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const setCookie = response.headers['set-cookie'] as unknown as string[];
    const accessCookie = setCookie.find((c) => c.startsWith('access_token='));
    if (!accessCookie) throw new Error('no access_token cookie in register response');

    const { user } = authUserResponseSchema.parse(response.body);
    return { cookie: accessCookie.split(';')[0], userId: user.id };
  }

  async function seedProject(
    members: Array<{ userId: string; role: Role }>,
    options: { deleted?: boolean } = {},
  ): Promise<string> {
    const project = await prisma.project.create({
      data: {
        name: 'Project',
        deletedAt: options.deleted ? new Date() : null,
        members: { create: members.map((m) => ({ userId: m.userId, role: m.role })) },
      },
    });
    return project.id;
  }

  async function seedPage(options: {
    projectId: string;
    deleted?: boolean;
  }): Promise<string> {
    const page = await prisma.page.create({
      data: {
        projectId: options.projectId,
        title: 'Page',
        parentId: null,
        position: 0,
        content: [],
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    return page.id;
  }

  it('участник + валидная cookie + верный секрет → 200 { allowed, userId }', async () => {
    const { cookie, userId } = await registerUser('c-ok@example.com');
    const projectId = await seedProject([{ userId, role: 'viewer' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(200);

    expect(response.body).toMatchObject({ allowed: true, userId });
  });

  it('owner → 200 (viewer — минимум, не равенство)', async () => {
    const { cookie, userId } = await registerUser('c-owner-ok@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(200);

    expect(response.body).toMatchObject({ allowed: true, userId });
  });

  it('editor → 200', async () => {
    const { cookie, userId } = await registerUser('c-editor-ok@example.com');
    const projectId = await seedProject([{ userId, role: 'editor' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(200);

    expect(response.body).toMatchObject({ allowed: true, userId });
  });

  it('участник + валидная cookie + НЕВЕРНЫЙ секрет → 403', async () => {
    const { cookie, userId } = await registerUser('c-badsecret@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', 'wrong-secret')
      .send({ documentName: pageId })
      .expect(403);

    expect(parseError(response.body).code).toBe('FORBIDDEN');
  });

  it('участник + валидная cookie + БЕЗ секрета → 403', async () => {
    const { cookie, userId } = await registerUser('c-nosecret@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .send({ documentName: pageId })
      .expect(403);

    expect(parseError(response.body).code).toBe('FORBIDDEN');
  });

  it('без секрета И без cookie → 403 (секрет проверяется раньше JWT)', async () => {
    const { userId } = await registerUser('c-secret-first@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    // Ни cookie, ни секрета. Если реализация проверит JWT первой — вернёт 401
    // и тест упадёт, зафиксировав нарушение порядка из спеки (секрет → JWT).
    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .send({ documentName: pageId })
      .expect(403);

    expect(parseError(response.body).code).toBe('FORBIDDEN');
  });

  it('НЕ участник + валидная cookie + верный секрет → 403', async () => {
    const { userId: ownerId } = await registerUser('c-owner@example.com');
    const { cookie: strangerCookie } = await registerUser('c-stranger@example.com');
    const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', strangerCookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(403);

    expect(parseError(response.body).code).toBe('FORBIDDEN');
  });

  it('без cookie (+ верный секрет) → 401', async () => {
    const { userId } = await registerUser('c-nocookie@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(401);

    expect(parseError(response.body).code).toBe('UNAUTHORIZED');
  });

  it('битая cookie → 401', async () => {
    const { userId } = await registerUser('c-badcookie@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', 'access_token=not-a-jwt')
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(401);

    expect(parseError(response.body).code).toBe('UNAUTHORIZED');
  });

  it('просроченный токен → 401', async () => {
    const { userId } = await registerUser('c-expired@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId });

    // Подписываем валидный по подписи, но заведомо истёкший access-токен.
    const expired = await jwt.signAsync({ sub: userId }, { expiresIn: '-1s' });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', `access_token=${expired}`)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(401);

    expect(parseError(response.body).code).toBe('UNAUTHORIZED');
  });

  it('неизвестная страница → 404', async () => {
    const { cookie } = await registerUser('c-nopage@example.com');

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: MISSING_ID })
      .expect(404);

    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });

  it('soft-deleted страница → 404', async () => {
    const { cookie, userId } = await registerUser('c-delpage@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }]);
    const pageId = await seedPage({ projectId, deleted: true });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(404);

    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });

  it('живая страница в soft-deleted проекте → 404 (как PageAccessGuard)', async () => {
    const { cookie, userId } = await registerUser('c-delproject@example.com');
    const projectId = await seedProject([{ userId, role: 'owner' }], { deleted: true });
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(404);

    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });

  it('НЕ участник + soft-deleted страница → 404 (существование раньше членства)', async () => {
    const { userId: ownerId } = await registerUser('c-del-stranger-owner@example.com');
    const { cookie: strangerCookie } = await registerUser('c-del-stranger@example.com');
    const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
    const pageId = await seedPage({ projectId, deleted: true });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', strangerCookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(404);

    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });

  it('НЕ участник + soft-deleted проект → 404', async () => {
    const { userId: ownerId } = await registerUser('c-delproj-stranger-owner@example.com');
    const { cookie: strangerCookie } = await registerUser('c-delproj-stranger@example.com');
    const projectId = await seedProject([{ userId: ownerId, role: 'owner' }], { deleted: true });
    const pageId = await seedPage({ projectId });

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', strangerCookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: pageId })
      .expect(404);

    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });

  it('невалидное тело (нет documentName) → 400', async () => {
    const { cookie } = await registerUser('c-badbody@example.com');

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({})
      .expect(400);

    expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
  });

  it('невалидное тело (documentName не uuid) → 400', async () => {
    const { cookie } = await registerUser('c-baduuid@example.com');

    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('Cookie', cookie)
      .set('X-Collab-Secret', secret)
      .send({ documentName: 'not-a-uuid' })
      .expect(400);

    expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
  });

  it('верный секрет + нет cookie + кривой uuid → 401 (JWT раньше валидации тела)', async () => {
    // Если Zod отработает первым — вернёт 400 без авторизации и тест упадёт,
    // зафиксировав нарушение порядка спеки (секрет → JWT → тело).
    const response = await request(server)
      .post(AUTHORIZE_PATH)
      .set('X-Collab-Secret', secret)
      .send({ documentName: 'not-a-uuid' })
      .expect(401);

    expect(parseError(response.body).code).toBe('UNAUTHORIZED');
  });
});
