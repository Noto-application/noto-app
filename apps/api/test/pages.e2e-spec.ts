import type { Server } from 'node:http';
import request from 'supertest';
import type { ApiError, PageResponse, PagesResponse } from '@noto/shared';
import {
  PAGE_CONTENT_MAX_LENGTH,
  apiErrorSchema,
  authUserResponseSchema,
  pageResponseSchema,
  pagesResponseSchema,
} from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

/**
 * E2E Pages CRUD — test-first (ADR-013), контракт из спеки
 * apps/api/src/pages/pages.spec.md и ADR-011.
 *
 * Тесты красные до реализации (PagesController/Service + расширение
 * ProjectAccessGuard — задача Тары): пока эндпоинтов нет, ответы 404.
 *
 * Setup: create проверяем через API (он под тестом); проект/участников/страницы
 * для остального сажаем напрямую через Prisma, чтобы кейсы не зависели от create.
 */

type Role = 'owner' | 'editor' | 'viewer';

const sampleContent = [{ type: 'paragraph', content: 'hello' }];

function parsePage(body: unknown): PageResponse {
  return pageResponseSchema.parse(body);
}

function parsePages(body: unknown): PagesResponse {
  return pagesResponseSchema.parse(body);
}

function parseError(body: unknown): ApiError {
  return apiErrorSchema.parse(body);
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Pages (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
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

  /** Сид проекта с участниками напрямую в БД. */
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

  /** Сид страницы напрямую в БД. */
  async function seedPage(options: {
    projectId: string;
    title?: string;
    parentId?: string | null;
    position?: number;
    content?: unknown[];
    deleted?: boolean;
  }): Promise<string> {
    const page = await prisma.page.create({
      data: {
        projectId: options.projectId,
        title: options.title ?? 'Page',
        parentId: options.parentId ?? null,
        position: options.position ?? 0,
        content: (options.content ?? []) as object[],
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    return page.id;
  }

  describe('POST /api/projects/:projectId/pages', () => {
    it('без авторизации → 401 UNAUTHORIZED', async () => {
      const { userId } = await registerUser('p-create-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);

      const response = await request(server)
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'New' })
        .expect(401);
      expect(parseError(response.body).code).toBe('UNAUTHORIZED');
    });

    it('не участник → 403 FORBIDDEN', async () => {
      const { userId: ownerId } = await registerUser('p-create-owner@example.com');
      const { agent } = await registerUser('p-create-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'New' })
        .expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('viewer → 403', async () => {
      const { agent, userId } = await registerUser('p-create-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);

      await agent.post(`/api/projects/${projectId}/pages`).send({ title: 'New' }).expect(403);
    });

    it('несуществующий проект → 404', async () => {
      const { agent } = await registerUser('p-create-404@example.com');
      await agent.post(`/api/projects/${MISSING_ID}/pages`).send({ title: 'New' }).expect(404);
    });

    it('удалённый проект → 404', async () => {
      const { agent, userId } = await registerUser('p-create-deleted-proj@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }], { deleted: true });
      await agent.post(`/api/projects/${projectId}/pages`).send({ title: 'New' }).expect(404);
    });

    it('пустой title → 400 VALIDATION_ERROR', async () => {
      const { agent, userId } = await registerUser('p-create-empty@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: '   ' })
        .expect(400);
      expect(parseError(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('слишком длинный title (>200) → 400', async () => {
      const { agent, userId } = await registerUser('p-create-long@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'x'.repeat(201) })
        .expect(400);
    });

    it('content не массив → 400', async () => {
      const { agent, userId } = await registerUser('p-create-badcontent@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'New', content: { not: 'an array' } })
        .expect(400);
    });

    it('content превышает лимит размера → 400', async () => {
      const { agent, userId } = await registerUser('p-create-toobig@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const huge = [{ text: 'x'.repeat(PAGE_CONTENT_MAX_LENGTH + 1) }];
      await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'New', content: huge })
        .expect(400);
    });

    it('editor создаёт → 201, возвращает страницу', async () => {
      const { agent, userId } = await registerUser('p-create-ok@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'My page', content: sampleContent })
        .expect(201);

      const { page } = parsePage(response.body);
      expect(page.title).toBe('My page');
      expect(page.projectId).toBe(projectId);
      expect(page.parentId).toBeNull();
      expect(page.content).toEqual(sampleContent);
    });

    it('пустой content по умолчанию, если не передан', async () => {
      const { agent, userId } = await registerUser('p-create-default@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'No content' })
        .expect(201);

      expect(parsePage(response.body).page.content).toEqual([]);
    });

    it('createdById проставляется создателем (атрибуция)', async () => {
      const { agent, userId } = await registerUser('p-create-author@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Authored' })
        .expect(201);

      const { page } = parsePage(response.body);
      const row = await prisma.page.findUnique({ where: { id: page.id } });
      expect(row?.createdById).toBe(userId);
    });

    it('parentId в том же проекте → 201', async () => {
      const { agent, userId } = await registerUser('p-create-parent@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const parentId = await seedPage({ projectId, title: 'Parent' });

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Child', parentId })
        .expect(201);

      expect(parsePage(response.body).page.parentId).toBe(parentId);
    });

    it('parentId из другого проекта → 400/404', async () => {
      const { agent, userId } = await registerUser('p-create-crossparent@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const otherProjectId = await seedProject([{ userId, role: 'editor' }]);
      const foreignParent = await seedPage({ projectId: otherProjectId });

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Child', parentId: foreignParent });
      expect([400, 404]).toContain(response.status);
    });

    it('parentId на несуществующую страницу → 400/404', async () => {
      const { agent, userId } = await registerUser('p-create-badparent@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Child', parentId: MISSING_ID });
      expect([400, 404]).toContain(response.status);
    });

    it('create с position → 201, position сохранён', async () => {
      const { agent, userId } = await registerUser('p-create-position@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      const response = await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Positioned', position: 3 })
        .expect(201);
      expect(parsePage(response.body).page.position).toBe(3);
    });

    it('превышение глубины дерева (>10) → 400', async () => {
      const { agent, userId } = await registerUser('p-create-deep@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      // Цепочка из 10 уровней (корень + 9 потомков) — 10-й уровень уже занят.
      let parentId: string | null = null;
      for (let depth = 0; depth < 10; depth += 1) {
        parentId = await seedPage({ projectId, parentId, title: `L${depth}` });
      }

      await agent
        .post(`/api/projects/${projectId}/pages`)
        .send({ title: 'Too deep', parentId })
        .expect(400);
    });
  });

  describe('GET /api/projects/:projectId/pages', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('p-list-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      await request(server).get(`/api/projects/${projectId}/pages`).expect(401);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('p-list-owner@example.com');
      const { agent } = await registerUser('p-list-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      await agent.get(`/api/projects/${projectId}/pages`).expect(403);
    });

    it('viewer видит список → 200, отсортирован по position', async () => {
      const { agent, userId } = await registerUser('p-list-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);
      await seedPage({ projectId, title: 'B', position: 1 });
      await seedPage({ projectId, title: 'A', position: 0 });

      const response = await agent.get(`/api/projects/${projectId}/pages`).expect(200);
      const { pages } = parsePages(response.body);
      expect(pages.map((p) => p.title)).toEqual(['A', 'B']);
    });

    it('не возвращает удалённые страницы', async () => {
      const { agent, userId } = await registerUser('p-list-deleted@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      await seedPage({ projectId, title: 'Alive' });
      await seedPage({ projectId, title: 'Gone', deleted: true });

      const response = await agent.get(`/api/projects/${projectId}/pages`).expect(200);
      expect(parsePages(response.body).pages.map((p) => p.title)).toEqual(['Alive']);
    });

    it('пустой список, если страниц нет → 200', async () => {
      const { agent, userId } = await registerUser('p-list-empty@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const response = await agent.get(`/api/projects/${projectId}/pages`).expect(200);
      expect(parsePages(response.body).pages).toEqual([]);
    });

    it('несуществующий проект → 404', async () => {
      const { agent } = await registerUser('p-list-404@example.com');
      await agent.get(`/api/projects/${MISSING_ID}/pages`).expect(404);
    });

    it('удалённый проект → 404', async () => {
      const { agent, userId } = await registerUser('p-list-deleted-proj@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }], { deleted: true });
      await agent.get(`/api/projects/${projectId}/pages`).expect(404);
    });
  });

  describe('GET /api/pages/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('p-get-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });
      await request(server).get(`/api/pages/${pageId}`).expect(401);
    });

    it('участник читает → 200, возвращает контент', async () => {
      const { agent, userId } = await registerUser('p-get-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);
      const pageId = await seedPage({ projectId, title: 'Readable', content: sampleContent });

      const response = await agent.get(`/api/pages/${pageId}`).expect(200);
      const { page } = parsePage(response.body);
      expect(page.id).toBe(pageId);
      expect(page.content).toEqual(sampleContent);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('p-get-owner@example.com');
      const { agent } = await registerUser('p-get-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });

      const response = await agent.get(`/api/pages/${pageId}`).expect(403);
      expect(parseError(response.body).code).toBe('FORBIDDEN');
    });

    it('несуществующая страница → 404', async () => {
      const { agent } = await registerUser('p-get-404@example.com');
      await agent.get(`/api/pages/${MISSING_ID}`).expect(404);
    });

    it('удалённая страница → 404', async () => {
      const { agent, userId } = await registerUser('p-get-deleted@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.get(`/api/pages/${pageId}`).expect(404);
    });

    it('не участник + удалённая страница → 404, не 403', async () => {
      const { userId: ownerId } = await registerUser('p-get-del-owner@example.com');
      const { agent } = await registerUser('p-get-del-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.get(`/api/pages/${pageId}`).expect(404);
    });

    it('страница удалённого проекта → 404', async () => {
      const { agent, userId } = await registerUser('p-get-deleted-proj@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }], { deleted: true });
      const pageId = await seedPage({ projectId });
      await agent.get(`/api/pages/${pageId}`).expect(404);
    });
  });

  describe('PATCH /api/pages/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('p-patch-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });
      await request(server).patch(`/api/pages/${pageId}`).send({ title: 'New' }).expect(401);
    });

    it('editor переименовывает → 200', async () => {
      const { agent, userId } = await registerUser('p-patch-editor@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId, title: 'Old' });

      const response = await agent
        .patch(`/api/pages/${pageId}`)
        .send({ title: 'Renamed' })
        .expect(200);
      expect(parsePage(response.body).page.title).toBe('Renamed');
    });

    it('editor обновляет content → 200', async () => {
      const { agent, userId } = await registerUser('p-patch-content@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      const response = await agent
        .patch(`/api/pages/${pageId}`)
        .send({ content: sampleContent })
        .expect(200);
      expect(parsePage(response.body).page.content).toEqual(sampleContent);
    });

    it('viewer → 403', async () => {
      const { agent, userId } = await registerUser('p-patch-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);
      const pageId = await seedPage({ projectId });
      await agent.patch(`/api/pages/${pageId}`).send({ title: 'New' }).expect(403);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('p-patch-owner@example.com');
      const { agent } = await registerUser('p-patch-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });
      await agent.patch(`/api/pages/${pageId}`).send({ title: 'New' }).expect(403);
    });

    it('пустой title → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-empty@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await agent.patch(`/api/pages/${pageId}`).send({ title: '   ' }).expect(400);
    });

    it('content превышает лимит → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-toobig@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      const huge = [{ text: 'x'.repeat(PAGE_CONTENT_MAX_LENGTH + 1) }];
      await agent.patch(`/api/pages/${pageId}`).send({ content: huge }).expect(400);
    });

    it('несуществующая страница → 404', async () => {
      const { agent } = await registerUser('p-patch-404@example.com');
      await agent.patch(`/api/pages/${MISSING_ID}`).send({ title: 'New' }).expect(404);
    });

    it('удалённая страница → 404', async () => {
      const { agent, userId } = await registerUser('p-patch-deleted@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.patch(`/api/pages/${pageId}`).send({ title: 'New' }).expect(404);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move: смена parentId → 200', async () => {
      const { agent, userId } = await registerUser('p-patch-move@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const newParent = await seedPage({ projectId, title: 'Parent' });
      const pageId = await seedPage({ projectId, title: 'Child' });

      const response = await agent
        .patch(`/api/pages/${pageId}`)
        .send({ parentId: newParent })
        .expect(200);
      expect(parsePage(response.body).page.parentId).toBe(newParent);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move в себя (цикл) → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-self@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await agent.patch(`/api/pages/${pageId}`).send({ parentId: pageId }).expect(400);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move под собственного потомка (цикл) → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-cycle@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const parentId = await seedPage({ projectId, title: 'Parent' });
      const childId = await seedPage({ projectId, title: 'Child', parentId });

      await agent.patch(`/api/pages/${parentId}`).send({ parentId: childId }).expect(400);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move под родителя из другого проекта → 400/404', async () => {
      const { agent, userId } = await registerUser('p-patch-crossmove@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const otherProjectId = await seedProject([{ userId, role: 'editor' }]);
      const foreignParent = await seedPage({ projectId: otherProjectId });
      const pageId = await seedPage({ projectId });

      const response = await agent.patch(`/api/pages/${pageId}`).send({ parentId: foreignParent });
      expect([400, 404]).toContain(response.status);
    });

    it('content не массив → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-badcontent@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await agent.patch(`/api/pages/${pageId}`).send({ content: { not: 'array' } }).expect(400);
    });

    it('слишком длинный title (>200) → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-long@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });
      await agent
        .patch(`/api/pages/${pageId}`)
        .send({ title: 'x'.repeat(201) })
        .expect(400);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move: смена position → 200', async () => {
      const { agent, userId } = await registerUser('p-patch-position@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId, position: 0 });

      const response = await agent
        .patch(`/api/pages/${pageId}`)
        .send({ position: 5 })
        .expect(200);
      expect(parsePage(response.body).page.position).toBe(5);
    });

    // move — #47 (в #48 parentId/position игнорируются)
    it.skip('move под потомка глубже лимита (>10) → 400', async () => {
      const { agent, userId } = await registerUser('p-patch-deepmove@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);

      // Цепочка из 10 уровней; переносим отдельную страницу под самый низ (→ 11-й).
      let parentId: string | null = null;
      for (let depth = 0; depth < 10; depth += 1) {
        parentId = await seedPage({ projectId, parentId, title: `L${depth}` });
      }
      const loose = await seedPage({ projectId, title: 'Loose' });

      await agent.patch(`/api/pages/${loose}`).send({ parentId }).expect(400);
    });

    it('не участник + удалённая страница → 404 на PATCH', async () => {
      const { userId: ownerId } = await registerUser('p-patch-del-owner@example.com');
      const { agent } = await registerUser('p-patch-del-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.patch(`/api/pages/${pageId}`).send({ title: 'New' }).expect(404);
    });
  });

  // DELETE — soft-delete, реализуется в #49. Скип до её мёржа.
  describe.skip('DELETE /api/pages/:id', () => {
    it('без авторизации → 401', async () => {
      const { userId } = await registerUser('p-del-noauth@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });
      await request(server).delete(`/api/pages/${pageId}`).expect(401);
    });

    it('editor удаляет (soft) → 204, страница пропадает', async () => {
      const { agent, userId } = await registerUser('p-del-editor@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const pageId = await seedPage({ projectId });

      await agent.delete(`/api/pages/${pageId}`).expect(204);

      const row = await prisma.page.findUnique({ where: { id: pageId } });
      expect(row?.deletedAt).not.toBeNull();
      await agent.get(`/api/pages/${pageId}`).expect(404);
    });

    it('viewer → 403', async () => {
      const { agent, userId } = await registerUser('p-del-viewer@example.com');
      const projectId = await seedProject([{ userId, role: 'viewer' }]);
      const pageId = await seedPage({ projectId });
      await agent.delete(`/api/pages/${pageId}`).expect(403);
    });

    it('не участник → 403', async () => {
      const { userId: ownerId } = await registerUser('p-del-owner@example.com');
      const { agent } = await registerUser('p-del-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId });
      await agent.delete(`/api/pages/${pageId}`).expect(403);
    });

    it('несуществующая страница → 404', async () => {
      const { agent } = await registerUser('p-del-404@example.com');
      await agent.delete(`/api/pages/${MISSING_ID}`).expect(404);
    });

    it('повторное удаление уже удалённой → 404', async () => {
      const { agent, userId } = await registerUser('p-del-twice@example.com');
      const projectId = await seedProject([{ userId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.delete(`/api/pages/${pageId}`).expect(404);
    });

    it('не участник + удалённая страница → 404 на DELETE', async () => {
      const { userId: ownerId } = await registerUser('p-del-del-owner@example.com');
      const { agent } = await registerUser('p-del-del-stranger@example.com');
      const projectId = await seedProject([{ userId: ownerId, role: 'owner' }]);
      const pageId = await seedPage({ projectId, deleted: true });
      await agent.delete(`/api/pages/${pageId}`).expect(404);
    });

    it('каскадный soft-delete: удаление родителя скрывает поддерево', async () => {
      const { agent, userId } = await registerUser('p-del-cascade@example.com');
      const projectId = await seedProject([{ userId, role: 'editor' }]);
      const parentId = await seedPage({ projectId, title: 'Parent' });
      const childId = await seedPage({ projectId, title: 'Child', parentId });
      const grandchildId = await seedPage({ projectId, title: 'Grandchild', parentId: childId });

      await agent.delete(`/api/pages/${parentId}`).expect(204);

      await agent.get(`/api/pages/${childId}`).expect(404);
      await agent.get(`/api/pages/${grandchildId}`).expect(404);
    });
  });

  it('error-ответы соответствуют общему shape { code, message }', async () => {
    const { agent } = await registerUser('p-shape@example.com');
    const response = await agent.get(`/api/pages/${MISSING_ID}`).expect(404);
    expect(parseError(response.body).code).toBe('NOT_FOUND');
  });
});
