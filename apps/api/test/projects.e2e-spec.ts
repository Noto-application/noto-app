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

    // register создаёт дефолтный проект (#88); эти тесты задают набор проектов
    // вручную, поэтому убираем его — membership каскадится при удалении проекта.
    await prisma.project.deleteMany({ where: { members: { some: { userId: user.id } } } });

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
      const response = await agent.post('/api/projects').send({ name: 'My project' }).expect(201);

      const { project } = parseProject(response.body);
      expect(project.name).toBe('My project');
      expect(typeof project.id).toBe('string');
    });

    it('создатель становится owner', async () => {
      const { agent, userId } = await registerUser('create-owner@example.com');
      const response = await agent.post('/api/projects').send({ name: 'Owned' }).expect(201);

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

  describe('currentUserRole в публичном Project', () => {
    function rawRecord(value: unknown): Record<string, unknown> {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Expected a JSON object');
      }
      return value as Record<string, unknown>;
    }

    function rawProject(body: unknown) {
      return rawRecord(rawRecord(body).project);
    }

    function rawProjects(body: unknown) {
      const values = rawRecord(body).projects;
      if (!Array.isArray(values)) throw new Error('Expected a projects array');
      return values.map((value: unknown) => rawRecord(value));
    }

    // Проверяем сырой HTTP DTO до Zod parse: parse мог бы скрыть утечку лишних полей.
    function expectPublicProject(value: Record<string, unknown>, role: Role) {
      expect(Object.keys(value).sort()).toEqual(
        ['id', 'name', 'createdAt', 'updatedAt', 'currentUserRole'].sort(),
      );
      for (const key of ['id', 'name', 'createdAt', 'updatedAt']) {
        expect(typeof value[key]).toBe('string');
      }
      expect(value.currentUserRole).toBe(role);
    }

    it('один пустой проект возвращает каждому из трёх участников его роль в list/get', async () => {
      const owner = await registerUser('role-owner@example.com');
      const editor = await registerUser('role-editor@example.com');
      const viewer = await registerUser('role-viewer@example.com');
      const members = [
        { ...owner, role: 'owner' as const },
        { ...editor, role: 'editor' as const },
        { ...viewer, role: 'viewer' as const },
      ];
      const id = await seedProject('Empty shared project', members);
      expect(await prisma.page.count({ where: { projectId: id } })).toBe(0);

      for (const { agent, role } of members) {
        const detail = await agent.get(`/api/projects/${id}`).expect(200);
        expect(rawProject(detail.body).id).toBe(id);
        expectPublicProject(rawProject(detail.body), role);
        const list = await agent.get('/api/projects').expect(200);
        const items = rawProjects(list.body);
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(id);
        expectPublicProject(items[0], role);
      }
    });

    it('list возвращает разные роли одного пользователя по проектам без чужих и удалённых', async () => {
      const { agent, userId } = await registerUser('role-many@example.com');
      const { userId: otherId } = await registerUser('role-other@example.com');
      const roles: Role[] = ['owner', 'editor', 'viewer'];
      const projects = [];
      for (const role of roles) {
        projects.push({ id: await seedProject(role, [{ userId, role }]), role });
      }
      await seedProject('Private', [{ userId: otherId, role: 'owner' }]);
      await seedProject('Deleted', [{ userId, role: 'owner' }], { deleted: true });

      const response = await agent.get('/api/projects').expect(200);
      const items = rawProjects(response.body);
      expect(items.map((item) => item.id).sort()).toEqual(projects.map(({ id }) => id).sort());
      for (const { id, role } of projects) {
        const item = items.find((value) => value.id === id);
        expectPublicProject(rawRecord(item), role);
        const detail = await agent.get(`/api/projects/${id}`).expect(200);
        expectPublicProject(rawProject(detail.body), role);
      }
    });

    it('create игнорирует неизвестную входную роль и возвращает 201 с owner-membership', async () => {
      const { agent, userId } = await registerUser('role-create@example.com');
      const response = await agent
        .post('/api/projects')
        .send({ name: 'Created', currentUserRole: 'administrator' })
        .expect(201);
      expectPublicProject(rawProject(response.body), 'owner');
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: parseProject(response.body).project.id, userId } },
      });
      expect(member).toMatchObject({ role: 'owner' });
      expect(rawProject(response.body).name).toBe('Created');
    });

    it.each(['owner', 'editor'] as const)(
      'update от %s игнорирует входную роль, возвращает 200 и сохраняет membership',
      async (role) => {
        const { agent, userId } = await registerUser(`role-update-${role}@example.com`);
        const id = await seedProject('Old', [{ userId, role }]);
        const response = await agent
          .patch(`/api/projects/${id}`)
          .send({ name: 'Renamed', currentUserRole: role === 'editor' ? 'owner' : 'administrator' })
          .expect(200);
        const member = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId } },
        });
        expect(member).toMatchObject({ role });
        expect(rawProject(response.body)).toMatchObject({ id, name: 'Renamed' });
        expectPublicProject(rawProject(response.body), role);
      },
    );

    it('регистрация возвращает только user; дефолтный проект имеет owner в list/get', async () => {
      const agent = request.agent(server);
      const registration = await agent
        .post('/api/auth/register')
        .send({ email: 'role-default@example.com', password: 'password123' })
        .expect(201);
      expect(Object.keys(rawRecord(registration.body))).toEqual(['user']);
      const { user } = authUserResponseSchema.parse(registration.body);
      const list = await agent.get('/api/projects').expect(200);
      const items = rawProjects(list.body);
      expect(items).toHaveLength(1);
      expectPublicProject(items[0], 'owner');
      const project = parseProjects(list.body).projects[0];
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      });
      expect(member).toMatchObject({ role: 'owner' });
      const detail = await agent.get(`/api/projects/${project.id}`).expect(200);
      expectPublicProject(rawProject(detail.body), 'owner');
    });

    it('ранее выданная роль editor не разрешает мутацию после понижения до viewer', async () => {
      const { agent, userId } = await registerUser('role-snapshot@example.com');
      const id = await seedProject('Unchanged', [{ userId, role: 'editor' }]);
      const before = await agent.get(`/api/projects/${id}`).expect(200);
      expectPublicProject(rawProject(before.body), 'editor');
      await prisma.projectMember.update({
        where: { projectId_userId: { projectId: id, userId } },
        data: { role: 'viewer' },
      });

      const denied = await agent
        .patch(`/api/projects/${id}`)
        .send({ name: 'Forbidden', currentUserRole: 'editor' })
        .expect(403);
      expect(parseError(denied.body).code).toBe('FORBIDDEN');
      expect(denied.body).not.toHaveProperty('project');
      const after = await agent.get(`/api/projects/${id}`).expect(200);
      expect(rawProject(after.body).name).toBe('Unchanged');
      expectPublicProject(rawProject(after.body), 'viewer');
    });

    it.each(['viewer', 'outsider'] as const)(
      '%s не получает права через входную роль owner и не получает Project при отказе',
      async (access) => {
        const { userId: ownerId } = await registerUser(`role-denied-owner-${access}@example.com`);
        const { agent, userId } = await registerUser(`role-denied-${access}@example.com`);
        const members: Array<{ userId: string; role: Role }> = [{ userId: ownerId, role: 'owner' }];
        if (access === 'viewer') members.push({ userId, role: 'viewer' });
        const id = await seedProject('Private', members);
        const denied = await agent
          .patch(`/api/projects/${id}`)
          .send({ name: 'Forbidden', currentUserRole: 'owner' })
          .expect(403);
        expect(parseError(denied.body).code).toBe('FORBIDDEN');
        expect(denied.body).not.toHaveProperty('project');
        expect(denied.body).not.toHaveProperty('currentUserRole');
        expect(await prisma.project.findUnique({ where: { id } })).toMatchObject({
          name: 'Private',
        });
        const member = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId } },
        });
        if (access === 'viewer') expect(member).toMatchObject({ role: 'viewer' });
        else expect(member).toBeNull();
      },
    );
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
