import type { Server } from 'node:http';
import request from 'supertest';
import type { ApiError, UserResponse } from '@noto/shared';
import {
  USERNAME_MAX_LENGTH,
  apiErrorSchema,
  authUserResponseSchema,
  userResponseSchema,
} from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

/**
 * E2E профиль / username — test-first (ADR-013), контракт из спеки
 * apps/api/src/users/users.spec.md, issue #124.
 *
 * Тесты красные до реализации (UsersController/Service): пока эндпоинтов нет,
 * ответы 404. GET /auth/me с `username: null` уже живой — общий DTO.
 */

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

function parseUser(body: unknown): UserResponse {
  return userResponseSchema.parse(body);
}

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

/** Сырой `user` без Zod-strip: `z.object()` выкинул бы неизвестные поля вроде `passwordHash`. */
function expectNoPasswordHash(body: unknown): void {
  if (typeof body !== 'object' || body === null || !('user' in body)) {
    throw new Error('expected { user }');
  }
  expect(body.user).not.toHaveProperty('passwordHash');
}

describe('Users (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetAuthState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(
    email: string,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    const { user } = authUserResponseSchema.parse(response.body);
    return { agent, userId: user.id };
  }

  describe('GET /api/users/me', () => {
    it('без авторизации → 401 UNAUTHORIZED', async () => {
      const response = await request(server).get('/api/users/me').expect(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('новый пользователь → 200, username: null, без passwordHash', async () => {
      const { agent, userId } = await registerUser('me-null@example.com');

      const response = await agent.get('/api/users/me').expect(200);
      const body = parseUser(response.body);

      expect(body.user).toMatchObject({
        id: userId,
        email: 'me-null@example.com',
        username: null,
      });
      expectNoPasswordHash(response.body);
    });
  });

  describe('GET /api/auth/me (тот же user DTO)', () => {
    it('после register username: null, приложение работает без имени', async () => {
      const { agent } = await registerUser('auth-me-null@example.com');

      const response = await agent.get('/api/auth/me').expect(200);
      const { user } = authUserResponseSchema.parse(response.body);

      expect(user.username).toBeNull();
      expectNoPasswordHash(response.body);
    });
  });

  describe('PATCH /api/users/:userId', () => {
    it('без авторизации → 401 UNAUTHORIZED', async () => {
      const response = await request(server)
        .patch(`/api/users/${MISSING_ID}`)
        .send({ username: 'Alex' })
        .expect(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('чужой существующий userId → 403 FORBIDDEN, имя жертвы не меняется', async () => {
      const { agent } = await registerUser('patch-attacker@example.com');
      const { agent: otherAgent, userId: otherId } = await registerUser(
        'patch-victim@example.com',
      );

      const response = await agent
        .patch(`/api/users/${otherId}`)
        .send({ username: 'Hacked' })
        .expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');

      const victim = await otherAgent.get('/api/auth/me').expect(200);
      expect(authUserResponseSchema.parse(victim.body).user.username).toBeNull();
    });

    it('чужой несуществующий userId → 403 FORBIDDEN (не 404)', async () => {
      const { agent } = await registerUser('patch-ghost@example.com');

      const response = await agent
        .patch(`/api/users/${MISSING_ID}`)
        .send({ username: 'Alex' })
        .expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('свой id, пользователя уже нет в БД → 404 NOT_FOUND', async () => {
      const { agent, userId } = await registerUser('patch-deleted@example.com');
      await prisma.user.delete({ where: { id: userId } });

      const response = await agent
        .patch(`/api/users/${userId}`)
        .send({ username: 'Alex' })
        .expect(404);
      expect(parseError(response.body).code).toBe('NOT_FOUND');
    });

    it('пустой username → 400 VALIDATION_ERROR', async () => {
      const { agent, userId } = await registerUser('patch-empty@example.com');

      const response = await agent.patch(`/api/users/${userId}`).send({ username: '' }).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('одни пробелы → 400 VALIDATION_ERROR', async () => {
      const { agent, userId } = await registerUser('patch-spaces@example.com');

      const response = await agent
        .patch(`/api/users/${userId}`)
        .send({ username: '   ' })
        .expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('длиннее 80 символов → 400 VALIDATION_ERROR', async () => {
      const { agent, userId } = await registerUser('patch-long@example.com');

      const response = await agent
        .patch(`/api/users/${userId}`)
        .send({ username: 'x'.repeat(USERNAME_MAX_LENGTH + 1) })
        .expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('тело без username → 400 VALIDATION_ERROR', async () => {
      const { agent, userId } = await registerUser('patch-nobody@example.com');

      const response = await agent.patch(`/api/users/${userId}`).send({}).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('не-uuid в :userId → 400 VALIDATION_ERROR', async () => {
      const { agent } = await registerUser('patch-badid@example.com');

      const response = await agent
        .patch('/api/users/not-a-uuid')
        .send({ username: 'Alex' })
        .expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('задаёт имя, trim по краям, повторный PATCH заменяет', async () => {
      const { agent, userId } = await registerUser('patch-ok@example.com');

      const created = await agent
        .patch(`/api/users/${userId}`)
        .send({ username: '  Alex  ' })
        .expect(200);
      expect(parseUser(created.body).user).toMatchObject({
        id: userId,
        username: 'Alex',
      });
      expectNoPasswordHash(created.body);

      const me = await agent.get('/api/users/me').expect(200);
      expect(parseUser(me.body).user.username).toBe('Alex');

      const authMe = await agent.get('/api/auth/me').expect(200);
      expect(authUserResponseSchema.parse(authMe.body).user.username).toBe('Alex');

      const replaced = await agent
        .patch(`/api/users/${userId}`)
        .send({ username: 'Ivan Petrov' })
        .expect(200);
      expect(parseUser(replaced.body).user.username).toBe('Ivan Petrov');
    });

    it('два пользователя могут иметь одно имя (не unique)', async () => {
      const { agent: first, userId: firstId } = await registerUser('same-a@example.com');
      const { agent: second, userId: secondId } = await registerUser('same-b@example.com');

      await first.patch(`/api/users/${firstId}`).send({ username: 'Alex' }).expect(200);
      await second.patch(`/api/users/${secondId}`).send({ username: 'Alex' }).expect(200);

      const a = await first.get('/api/users/me').expect(200);
      const b = await second.get('/api/users/me').expect(200);
      expect(parseUser(a.body).user.username).toBe('Alex');
      expect(parseUser(b.body).user.username).toBe('Alex');
    });
  });
});
