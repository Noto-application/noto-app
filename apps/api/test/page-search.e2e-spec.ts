import type { Server } from 'node:http';
import request from 'supertest';
import { authUserResponseSchema, apiErrorSchema } from '@noto/shared';

import { createTestApp, resetAuthState } from './helpers/test-app';

type Role = 'owner' | 'editor' | 'viewer';
type Agent = ReturnType<typeof request.agent>;
type SearchResult = {
  pageId: string;
  title: string;
  projectId: string;
  projectName: string;
};

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Поиск страниц (e2e)', () => {
  let server: Server;
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createTestApp>>['prisma'];
  let redis: Awaited<ReturnType<typeof createTestApp>>['redis'];

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
    server = app.getHttpServer();
  });

  beforeEach(async () => resetAuthState(prisma, redis));
  afterAll(async () => app.close());

  async function user(email: string): Promise<{ agent: Agent; userId: string }> {
    const agent = request.agent(server);
    const response = await agent
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return { agent, userId: authUserResponseSchema.parse(response.body).user.id };
  }

  async function project(
    members: Array<{ userId: string; role: Role }>,
    options: { name?: string; deleted?: boolean } = {},
  ): Promise<string> {
    const row = await prisma.project.create({
      data: {
        name: options.name ?? 'Project',
        deletedAt: options.deleted ? new Date() : null,
        members: { create: members },
      },
    });
    return row.id;
  }

  async function page(options: {
    projectId: string;
    title: string;
    parentId?: string | null;
    deleted?: boolean;
    id?: string;
  }): Promise<string> {
    const row = await prisma.page.create({
      data: {
        id: options.id,
        projectId: options.projectId,
        title: options.title,
        parentId: options.parentId ?? null,
        content: [{ type: 'paragraph', content: 'private page body' }],
        deletedAt: options.deleted ? new Date() : null,
      },
    });
    return row.id;
  }

  function search(
    agent: Agent,
    q: string | undefined,
    options: { projectId?: string; limit?: number; cursor?: string } = {},
  ) {
    const query: Record<string, string | number> = {};
    if (q !== undefined) query.q = q;
    if (options.projectId !== undefined) query.projectId = options.projectId;
    if (options.limit !== undefined) query.limit = options.limit;
    if (options.cursor !== undefined) query.cursor = options.cursor;
    return agent.get('/api/pages/search').query(query);
  }

  function parseSearch(body: unknown): { results: SearchResult[]; nextCursor: string | null } {
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
    expect(Object.keys(body as object).sort()).toEqual(['nextCursor', 'results']);

    const response = body as { results: unknown; nextCursor: unknown };
    expect(Array.isArray(response.results)).toBe(true);
    for (const item of response.results as unknown[]) {
      expect(item).not.toBeNull();
      expect(typeof item).toBe('object');
      expect(Object.keys(item as object).sort()).toEqual([
        'pageId',
        'projectId',
        'projectName',
        'title',
      ]);
      const result = item as SearchResult;
      expect(typeof result.pageId).toBe('string');
      expect(typeof result.projectId).toBe('string');
      expect(typeof result.projectName).toBe('string');
      expect(typeof result.title).toBe('string');
    }
    expect([null, 'string']).toContain(
      response.nextCursor === null ? null : typeof response.nextCursor,
    );
    return response as { results: SearchResult[]; nextCursor: string | null };
  }

  async function searchResults(
    agent: Agent,
    q: string,
    options: { projectId?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ results: SearchResult[]; nextCursor: string | null }> {
    const response = await search(agent, q, options).expect(200);
    return parseSearch(response.body);
  }

  function expectError(body: unknown, code: string): void {
    expect(apiErrorSchema.parse(body).code).toBe(code);
  }

  describe('GET /api/pages/search', () => {
    it('требует аутентификацию', async () => {
      const response = await request(server).get('/api/pages/search').query({ q: 'title' });
      expect(response.status).toBe(401);
      expectError(response.body, 'UNAUTHORIZED');
    });

    it('ищет подстроку в заголовке без учёта регистра и возвращает только поля для отображения', async () => {
      const { userId, agent } = await user('search-case@example.com');
      const projectId = await project([{ userId, role: 'viewer' }], { name: 'Research' });
      const matchingPageId = await page({
        projectId,
        title: 'Quarterly Сводка',
      });
      await page({ projectId, title: 'Unrelated page' });

      const response = await search(agent, 'СВОДКА').expect(200);
      const result = parseSearch(response.body).results;
      expect(result).toEqual([
        {
          pageId: matchingPageId,
          title: 'Quarterly Сводка',
          projectId,
          projectName: 'Research',
        },
      ]);
      expect(JSON.stringify(response.body)).not.toContain('private page body');
    });

    it('обрезает пробелы по краям запроса и сохраняет пробелы внутри', async () => {
      const { userId, agent } = await user('search-spaces@example.com');
      const projectId = await project([{ userId, role: 'editor' }]);
      const expectedId = await page({ projectId, title: 'Release   notes' });
      await page({ projectId, title: 'Release notes' });

      const { results } = await searchResults(agent, '  Release   notes  ');
      expect(results.map((result) => result.pageId)).toEqual([expectedId]);
    });

    it('ищет специальные символы SQL LIKE буквально', async () => {
      const { userId, agent } = await user('search-special@example.com');
      const projectId = await project([{ userId, role: 'owner' }]);
      const percentId = await page({ projectId, title: 'Budget 100% ready' });
      const underscoreId = await page({ projectId, title: 'file_name' });
      const slashId = await page({ projectId, title: 'C:\\notes' });
      await page({ projectId, title: 'Budget 1000 ready' });
      await page({ projectId, title: 'filename' });
      await page({ projectId, title: 'C:notes' });

      expect((await searchResults(agent, '%')).results).toEqual([
        expect.objectContaining({ pageId: percentId, title: 'Budget 100% ready' }),
      ]);
      expect((await searchResults(agent, '_')).results).toEqual([
        expect.objectContaining({ pageId: underscoreId, title: 'file_name' }),
      ]);
      expect((await searchResults(agent, '\\')).results).toEqual([
        expect.objectContaining({ pageId: slashId, title: 'C:\\notes' }),
      ]);
    });

    it('фильтрует по выбранному проекту и разрешает поиск участникам с любой ролью', async () => {
      const { userId: ownerId, agent: owner } = await user('search-roles-owner@example.com');
      const { userId: editorId, agent: editor } = await user('search-roles-editor@example.com');
      const { userId: viewerId, agent: viewer } = await user('search-roles-viewer@example.com');
      const projectA = await project([
        { userId: ownerId, role: 'owner' },
        { userId: editorId, role: 'editor' },
        { userId: viewerId, role: 'viewer' },
      ]);
      const projectB = await project([{ userId: viewerId, role: 'viewer' }]);
      const pageA = await page({ projectId: projectA, title: 'Shared title A' });
      const pageB = await page({ projectId: projectB, title: 'Shared title B' });

      for (const agent of [owner, editor]) {
        const allProjects = await searchResults(agent, 'Shared title');
        expect(allProjects.results.map((result) => result.pageId)).toEqual([pageA]);

        const oneProject = await searchResults(agent, 'Shared title', { projectId: projectA });
        expect(oneProject.results.map((result) => result.pageId)).toEqual([pageA]);

        const inaccessibleProject = await search(agent, 'Shared title', {
          projectId: projectB,
        });
        expect(inaccessibleProject.status).toBe(403);
        expectError(inaccessibleProject.body, 'FORBIDDEN');
      }

      const viewerResults = await searchResults(viewer, 'Shared title');
      expect(viewerResults.results.map((result) => result.pageId).sort()).toEqual(
        [pageA, pageB].sort(),
      );
      const viewerProjectB = await searchResults(viewer, 'Shared title', {
        projectId: projectB,
      });
      expect(viewerProjectB.results.map((result) => result.pageId)).toEqual([pageB]);
    });

    it('возвращает пустую выдачу для пустого результата и пользователя без членств', async () => {
      const { userId: memberId, agent: member } = await user('search-empty-member@example.com');
      const { agent: outsider } = await user('search-empty-outsider@example.com');
      const projectId = await project([{ userId: memberId, role: 'viewer' }]);
      await page({ projectId, title: 'Existing page' });

      expect(await searchResults(member, 'absent')).toEqual({
        results: [],
        nextCursor: null,
      });
      expect(await searchResults(outsider, 'Existing')).toEqual({
        results: [],
        nextCursor: null,
      });
    });

    it('возвращает страницы только из доступных пользователю неудалённых проектов', async () => {
      const { userId, agent } = await user('search-memberships@example.com');
      const { userId: otherUserId } = await user('search-other@example.com');
      const memberProject = await project([{ userId, role: 'viewer' }], { name: 'Member project' });
      const privateProject = await project([{ userId: otherUserId, role: 'owner' }], {
        name: 'Private project',
      });
      const deletedProject = await project([{ userId, role: 'owner' }], {
        name: 'Deleted project',
        deleted: true,
      });
      const memberPage = await page({ projectId: memberProject, title: 'match member' });
      await page({ projectId: privateProject, title: 'match private' });
      await page({ projectId: deletedProject, title: 'match deleted project' });

      const { results } = await searchResults(agent, 'match');
      expect(results.map((result) => result.pageId)).toEqual([memberPage]);
      expect(JSON.stringify(results)).not.toContain('Private project');
    });

    it('запрещает поиск неучастнику и возвращает 404 для отсутствующего или удалённого проекта', async () => {
      const { userId: ownerId } = await user('search-project-owner@example.com');
      const { agent: outsider } = await user('search-project-outsider@example.com');
      const liveProject = await project([{ userId: ownerId, role: 'owner' }]);
      const deletedProject = await project([{ userId: ownerId, role: 'owner' }], {
        deleted: true,
      });

      const forbidden = await search(outsider, 'title', { projectId: liveProject });
      expect(forbidden.status).toBe(403);
      expectError(forbidden.body, 'FORBIDDEN');

      const missing = await search(outsider, 'title', { projectId: MISSING_ID });
      expect(missing.status).toBe(404);
      expectError(missing.body, 'NOT_FOUND');

      const deleted = await search(outsider, 'title', { projectId: deletedProject });
      expect(deleted.status).toBe(404);
      expectError(deleted.body, 'NOT_FOUND');
    });

    it('исключает удалённые страницы и страницы с удалённым или чужим предком', async () => {
      const { userId, agent } = await user('search-ancestors@example.com');
      const projectId = await project([{ userId, role: 'owner' }]);
      const deletedAncestorId = await page({
        projectId,
        title: 'match deleted ancestor',
        deleted: true,
      });
      await page({
        projectId,
        title: 'match under deleted ancestor',
        parentId: deletedAncestorId,
      });
      const deletedDistantAncestorId = await page({
        projectId,
        title: 'deleted distant ancestor',
        deleted: true,
      });
      const liveIntermediateId = await page({
        projectId,
        title: 'live intermediate',
        parentId: deletedDistantAncestorId,
      });
      await page({
        projectId,
        title: 'match under distant deleted ancestor',
        parentId: liveIntermediateId,
      });
      await page({ projectId, title: 'match deleted page', deleted: true });
      const otherProjectId = await project([{ userId, role: 'owner' }]);
      const foreignAncestorId = await page({ projectId: otherProjectId, title: 'foreign parent' });
      await page({
        projectId,
        title: 'match under foreign ancestor',
        parentId: foreignAncestorId,
      });
      const livePageId = await page({ projectId, title: 'match live page' });

      const { results } = await searchResults(agent, 'match');
      expect(results.map((result) => result.pageId)).toEqual([livePageId]);
    });

    it('применяет ACL и lifecycle-фильтры до пагинации на каждой порции', async () => {
      const { userId, agent } = await user('search-filtered-pagination@example.com');
      const { userId: otherUserId } = await user('search-filtered-pagination-other@example.com');
      const projectId = await project([{ userId, role: 'viewer' }]);
      const privateProjectId = await project([{ userId: otherUserId, role: 'owner' }]);

      await page({ projectId, title: 'a mix deleted before first page', deleted: true });
      const firstVisibleId = await page({ projectId, title: 'b mix first' });
      await page({ projectId, title: 'c mix deleted page', deleted: true });
      await page({ projectId: privateProjectId, title: 'd mix private' });
      const secondVisibleId = await page({ projectId, title: 'e mix second' });
      const deletedAncestorId = await page({
        projectId,
        title: 'f mix deleted ancestor',
        deleted: true,
      });
      await page({
        projectId,
        title: 'g mix under deleted ancestor',
        parentId: deletedAncestorId,
      });
      const thirdVisibleId = await page({ projectId, title: 'h mix third' });

      const collectedIds: string[] = [];
      const pageSizes: number[] = [];
      let cursor: string | undefined;
      do {
        const batch = await searchResults(agent, 'mix', { limit: 2, cursor });
        pageSizes.push(batch.results.length);
        collectedIds.push(...batch.results.map((result) => result.pageId));
        cursor = batch.nextCursor ?? undefined;
      } while (cursor !== undefined);

      expect(pageSizes).toEqual([2, 1]);
      expect(collectedIds).toEqual([firstVisibleId, secondVisibleId, thirdVisibleId]);
    });

    it('проверяет запрос, идентификатор проекта, лимит и курсор', async () => {
      const { userId, agent } = await user('search-validation@example.com');
      await project([{ userId, role: 'owner' }]);
      const invalidQueries: Array<Record<string, string | number>> = [
        {},
        { q: '' },
        { q: '   ' },
        { q: 'x'.repeat(201) },
        { q: 'title', projectId: 'not-a-uuid' },
        { q: 'title', limit: 0 },
        { q: 'title', limit: 51 },
        { q: 'title', cursor: 'not-a-valid-cursor' },
      ];

      for (const query of invalidQueries) {
        const response = await agent.get('/api/pages/search').query(query);
        expect(response.status).toBe(400);
        expectError(response.body, 'VALIDATION_ERROR');
      }
    });

    it('использует размер страницы по умолчанию и сообщает о наличии следующих результатов', async () => {
      const { userId, agent } = await user('search-default-limit@example.com');
      const projectId = await project([{ userId, role: 'viewer' }]);
      for (let index = 0; index < 21; index += 1) {
        await page({ projectId, title: `Default limit ${index.toString().padStart(2, '0')}` });
      }

      const { results, nextCursor } = await searchResults(agent, 'Default limit');
      expect(results).toHaveLength(20);
      expect(nextCursor).not.toBeNull();
    });

    it('принимает максимальную длину запроса и максимальный лимит', async () => {
      const { userId, agent } = await user('search-upper-bounds@example.com');
      const projectId = await project([{ userId, role: 'viewer' }]);
      const query = 'x'.repeat(200);
      const ids: string[] = [];
      for (let index = 0; index < 51; index += 1) {
        ids.push(await page({ projectId, title: query }));
      }

      const first = await searchResults(agent, query, { limit: 50 });
      expect(first.results).toHaveLength(50);
      expect(first.results.map((result) => result.pageId)).toEqual(ids.slice().sort().slice(0, 50));
      expect(first.nextCursor).not.toBeNull();

      const second = await searchResults(agent, query, {
        limit: 50,
        cursor: first.nextCursor!,
      });
      expect(second.results.map((result) => result.pageId)).toEqual(ids.slice().sort().slice(50));
      expect(second.nextCursor).toBeNull();
    });

    it('постранично возвращает результаты в стабильном порядке без повторов', async () => {
      const { userId, agent } = await user('search-pagination@example.com');
      const projectId = await project([{ userId, role: 'viewer' }]);
      const ids = [
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ];
      for (const id of ids) await page({ projectId, title: 'Same title', id });
      const anotherTitleId = await page({ projectId, title: 'Another title' });

      const first = await searchResults(agent, 'title', { limit: 2 });
      expect(first.results.map((result) => result.title)).toEqual(['Another title', 'Same title']);
      expect(first.results.map((result) => result.pageId)).toEqual([
        anotherTitleId,
        '00000000-0000-4000-8000-000000000001',
      ]);
      expect(first.nextCursor).not.toBeNull();

      const second = await searchResults(agent, 'title', {
        limit: 2,
        cursor: first.nextCursor!,
      });
      expect(second.results.map((result) => result.pageId)).toEqual([
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ]);
      expect(second.nextCursor).toBeNull();
      const returnedIds = [...first.results, ...second.results].map((result) => result.pageId);
      expect(returnedIds).toHaveLength(4);
      expect(new Set(returnedIds).size).toBe(4);
      expect(returnedIds.slice().sort()).toEqual([anotherTitleId, ...ids].sort());
    });

    it('повторно проверяет членство при продолжении выдачи', async () => {
      const { userId, agent } = await user('search-revoked-membership@example.com');
      const projectId = await project([{ userId, role: 'viewer' }]);
      await page({ projectId, title: 'Revoked membership A' });
      await page({ projectId, title: 'Revoked membership B' });

      const first = await searchResults(agent, 'Revoked membership', { limit: 1 });
      expect(first.results).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();

      await prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId } },
      });
      const second = await searchResults(agent, 'Revoked membership', {
        limit: 1,
        cursor: first.nextCursor!,
      });
      expect(second).toEqual({ results: [], nextCursor: null });
    });

    it('не позволяет использовать курсор с другим запросом или фильтром проекта', async () => {
      const { userId, agent } = await user('search-cursor-scope@example.com');
      const projectA = await project([{ userId, role: 'owner' }]);
      const projectB = await project([{ userId, role: 'owner' }]);
      await page({ projectId: projectA, title: 'Shared title A' });
      await page({ projectId: projectA, title: 'Shared title B' });
      await page({ projectId: projectB, title: 'Shared title C' });

      const firstPage = await searchResults(agent, 'Shared title', {
        projectId: projectA,
        limit: 1,
      });
      expect(firstPage.nextCursor).not.toBeNull();

      for (const options of [
        { projectId: projectA, q: 'different query' },
        { projectId: projectB, q: 'Shared title' },
      ]) {
        const response = await search(agent, options.q, {
          projectId: options.projectId,
          limit: 1,
          cursor: firstPage.nextCursor!,
        });
        expect(response.status).toBe(400);
        expectError(response.body, 'VALIDATION_ERROR');
      }
    });
  });
});
