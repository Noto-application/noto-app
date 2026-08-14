import type { Server } from 'node:http';
import request from 'supertest';
import type { ApiError, ProjectResponse, ProjectsResponse } from '@noto/shared';
import {
  apiErrorSchema,
  authUserResponseSchema,
  projectResponseSchema,
  projectsResponseSchema,
} from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

/**
 * E2E Projects CRUD — test-first (RFC-008), контракт из спеки
 * apps/api/src/projects/projects.spec.md и ADR-011.
 *
 * Тесты красные до реализации (ProjectsController/Service/Guard — задача Тары):
 * пока модуль пустой, эндпоинты дают 404.
 *
 * Setup: create-эндпоинт проверяем через API (он под тестом); для
 * get/list/update/delete проект и участников сажаем напрямую через Prisma,
 * чтобы кейсы не зависели от работоспособности create. Роли участника
 * (editor/viewer) выдаём тем же сидом — отдельного эндпоинта участников нет.
 */

type Role = 'owner' | 'editor' | 'viewer';

function parseProject(body: unknown): ProjectResponse {
  return projectResponseSchema.parse(body);
}

function parseProjects(body: unknown): ProjectsResponse {
  return projectsResponseSchema.parse(body);
}

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

describe('Projects (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await resetAuthState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Регистрирует пользователя и возвращает агента с auth-cookie + его id. */
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

  /** Сид проекта с участниками напрямую в БД (в обход API). */
  async function seedProject(
    name: string,
    members: Array<{ userId: string; role: Role }>,
    options: { deleted?: boolean } = {},
  ): Promise<string> {
    const project = await prisma.project.create({
      data: {
        name,
        deletedAt: options.deleted ? new Date() : null,
        members: { create: members.map((m) => ({ userId: m.userId, role: m.role })) },
      },
    });
    return project.id;
  }

  describe('POST /api/projects', () => {
    it('без авторизации → 401 с кодом UNAUTHORIZED', async () => {
      const response = await request(server)
        .post('/api/projects')
        .send({ name: 'Proj' })
        .expect(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('пустое имя → 400 с кодом VALIDATION_ERROR', async () => {
      const { agent } = await registerUser('create-empty@example.com');
      const response = await agent.post('/api/projects').send({ name: '   ' }).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('слишком длинное имя → 400 с кодом VALIDATION_ERROR', async () => {
      const { agent } = await registerUser('create-long@example.com');
      const response = await agent
        .post('/api/projects')
        .send({ name: 'x'.repeat(101) })
        .expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('без поля name → 400 с кодом VALIDATION_ERROR', async () => {
      const { agent } = await registerUser('create-noname@example.com');
      const response = await agent.post('/api/projects').send({}).expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('успех → 201, возвращает проект', async () => {
      const { agent } = await registerUser('create-ok@example.com');
      const response = await agent
        .post('/api/projects')
        .send({ name: 'My project' })
        .expect(201);

      const { project } = parseProject(response.body);
      expect(project.name).toBe('My project');
      expect(typeof project.id).toBe('string');
    });

    it('создатель становится owner', async () => {
      const { agent, userId } = await registerUser('create-owner@example.com');
      const response = await agent
        .post('/api/projects')
        .send({ name: 'Owned' })
        .expect(201);

      const { project } = parseProject(response.body);
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
      });
      expect(member?.role).toBe('owner');
    });
  });

  describe('GET /api/projects', () => {
    it('без авторизации → 401 с кодом UNAUTHORIZED', async () => {
      const response = await request(server).get('/api/projects').expect(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('возвращает только проекты, где пользователь — участник', async () => {
      const { agent, userId } = await registerUser('list-a@example.com');
      const { userId: otherId } = await registerUser('list-b@example.com');

      await seedProject('Mine 1', [{ userId, role: 'owner' }]);
      await seedProject('Mine 2', [{ userId, role: 'viewer' }]);
      await seedProject('Not mine', [{ userId: otherId, role: 'owner' }]);

      const response = await agent.get('/api/projects').expect(200);
      const { projects } = parseProjects(response.body);
      expect(projects.map((p) => p.name).sort()).toEqual(['Mine 1', 'Mine 2']);
    });

    it('не возвращает удалённые проекты', async () => {
      const { agent, userId } = await registerUser('list-deleted@example.com');
      await seedProject('Alive', [{ userId, role: 'owner' }]);
      await seedProject('Deleted', [{ userId, role: 'owner' }], { deleted: true });

      const response = await agent.get('/api/projects').expect(200);
      const { projects } = parseProjects(response.body);
      expect(projects.map((p) => p.name)).toEqual(['Alive']);
    });

    it('пустой список, если проектов нет → 200', async () => {
      const { agent } = await registerUser('list-empty@example.com');
      const response = await agent.get('/api/projects').expect(200);
      expect(parseProjects(response.body).projects).toEqual([]);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('get-noauth@example.com');
      const id = await seedProject('P', [{ userId, role: 'owner' }]);
      await request(server).get(`/api/projects/${id}`).expect(401);
    });

    it('участник (любая роль) читает → 200', async () => {
      const { agent, userId } = await registerUser('get-viewer@example.com');
      const id = await seedProject('Readable', [{ userId, role: 'viewer' }]);

      const response = await agent.get(`/api/projects/${id}`).expect(200);
      expect(parseProject(response.body).project.id).toBe(id);
    });

    it('не участник → 403 с кодом FORBIDDEN', async () => {
      const { userId: ownerId } = await registerUser('get-owner@example.com');
      const { agent } = await registerUser('get-stranger@example.com');
      const id = await seedProject('Private', [{ userId: ownerId, role: 'owner' }]);

      const response = await agent.get(`/api/projects/${id}`).expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('несуществующий id → 404', async () => {
      const { agent } = await registerUser('get-404@example.com');
      await agent.get('/api/projects/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('удалённый проект → 404', async () => {
      const { agent, userId } = await registerUser('get-deleted@example.com');
      const id = await seedProject('Gone', [{ userId, role: 'owner' }], { deleted: true });
      await agent.get(`/api/projects/${id}`).expect(404);
    });

    it('не участник + удалённый проект → 404, не 403', async () => {
      const { userId: ownerId } = await registerUser('get-deleted-owner@example.com');
      const { agent } = await registerUser('get-deleted-stranger@example.com');
      const id = await seedProject('Gone', [{ userId: ownerId, role: 'owner' }], {
        deleted: true,
      });
      await agent.get(`/api/projects/${id}`).expect(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('patch-noauth@example.com');
      const id = await seedProject('P', [{ userId, role: 'owner' }]);
      await request(server).patch(`/api/projects/${id}`).send({ name: 'New' }).expect(401);
    });

    it('editor переименовывает → 200', async () => {
      const { agent, userId } = await registerUser('patch-editor@example.com');
      const id = await seedProject('Old', [{ userId, role: 'editor' }]);

      const response = await agent
        .patch(`/api/projects/${id}`)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(parseProject(response.body).project.name).toBe('Renamed');
    });

    it('owner переименовывает → 200', async () => {
      const { agent, userId } = await registerUser('patch-owner@example.com');
      const id = await seedProject('Old', [{ userId, role: 'owner' }]);
      const response = await agent
        .patch(`/api/projects/${id}`)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(parseProject(response.body).project.name).toBe('Renamed');
    });

    it('viewer → 403', async () => {
      const { agent, userId } = await registerUser('patch-viewer@example.com');
      const id = await seedProject('Old', [{ userId, role: 'viewer' }]);
      await agent.patch(`/api/projects/${id}`).send({ name: 'Renamed' }).expect(403);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('patch-owner2@example.com');
      const { agent } = await registerUser('patch-stranger@example.com');
      const id = await seedProject('Old', [{ userId: ownerId, role: 'owner' }]);
      await agent.patch(`/api/projects/${id}`).send({ name: 'Renamed' }).expect(403);
    });

    it('пустое имя → 400', async () => {
      const { agent, userId } = await registerUser('patch-empty@example.com');
      const id = await seedProject('Old', [{ userId, role: 'editor' }]);
      await agent.patch(`/api/projects/${id}`).send({ name: '   ' }).expect(400);
    });

    it('несуществующий id → 404', async () => {
      const { agent } = await registerUser('patch-404@example.com');
      await agent
        .patch('/api/projects/00000000-0000-0000-0000-000000000000')
        .send({ name: 'New' })
        .expect(404);
    });

    it('удалённый проект → 404 (soft-deleted неизменяем)', async () => {
      const { agent, userId } = await registerUser('patch-deleted@example.com');
      const id = await seedProject('Gone', [{ userId, role: 'owner' }], { deleted: true });
      await agent.patch(`/api/projects/${id}`).send({ name: 'New' }).expect(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('del-noauth@example.com');
      const id = await seedProject('P', [{ userId, role: 'owner' }]);
      await request(server).delete(`/api/projects/${id}`).expect(401);
    });

    it('owner удаляет (soft) → 204, проект пропадает из выдачи', async () => {
      const { agent, userId } = await registerUser('del-owner@example.com');
      const id = await seedProject('Doomed', [{ userId, role: 'owner' }]);

      await agent.delete(`/api/projects/${id}`).expect(204);

      const deleted = await prisma.project.findUnique({ where: { id } });
      expect(deleted?.deletedAt).not.toBeNull();

      await agent.get(`/api/projects/${id}`).expect(404);
    });

    it('editor → 403', async () => {
      const { agent, userId } = await registerUser('del-editor@example.com');
      const id = await seedProject('P', [{ userId, role: 'editor' }]);
      await agent.delete(`/api/projects/${id}`).expect(403);
    });

    it('viewer → 403', async () => {
      const { agent, userId } = await registerUser('del-viewer@example.com');
      const id = await seedProject('P', [{ userId, role: 'viewer' }]);
      await agent.delete(`/api/projects/${id}`).expect(403);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('del-owner2@example.com');
      const { agent } = await registerUser('del-stranger@example.com');
      const id = await seedProject('P', [{ userId: ownerId, role: 'owner' }]);
      await agent.delete(`/api/projects/${id}`).expect(403);
    });

    it('несуществующий id → 404', async () => {
      const { agent } = await registerUser('del-404@example.com');
      await agent.delete('/api/projects/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('повторное удаление уже удалённого → 404', async () => {
      const { agent, userId } = await registerUser('del-twice@example.com');
      const id = await seedProject('Gone', [{ userId, role: 'owner' }], { deleted: true });
      await agent.delete(`/api/projects/${id}`).expect(404);
    });
  });

  it('error-ответы соответствуют общему shape { code, message }', async () => {
    const { agent } = await registerUser('shape@example.com');
    const response = await agent
      .get('/api/projects/00000000-0000-0000-0000-000000000000')
      .expect(404);
    const error = parseError(response.body);
    expect(error.code).toBe('NOT_FOUND');
  });
});
